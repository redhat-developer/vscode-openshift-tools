/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { fileSync } from 'tmp';
import { window } from 'vscode';
import { CommandText } from '../base/command';
import { OpenshiftLogger } from '../util/childProcessUtil';
import { TokenStore } from '../util/credentialManager';
import { ComponentWorkspaceFolder } from '../odo/workspace';
import { Data, Command, DeployedResource, DeployState, DeployStateFile } from '../odo/componentTypeDescription';
import { KubeConfig } from '@kubernetes/client-node';
import { Oc } from '../oc/ocWrapper';
import { isOpenShiftCluster } from '../util/kubeUtils';
import { OpenShiftTerminalManager } from '../webview/openshift-terminal/openShiftTerminal';
import { DevfileResolver } from './devfileResolver';
import { DevfileCommandRunner } from './devfileCommandRunner';
import { ApplyCommandExecutor, DeployScriptContribution } from './applyCommand';

export interface ComponentDeployOptions {
    componentPath: string;
    logger?: OpenshiftLogger;
    variables?: Record<string, string>;  // --var overrides
}

export interface ComponentDeployResult {
    componentName: string;
    deployedCommands: string[];
    deployedResources: DeployedResource[];
    success: boolean;
}

export async function deployComponent(
    options: ComponentDeployOptions,
    componentFolder: ComponentWorkspaceFolder
): Promise<ComponentDeployResult> {
    const ctx = createDeployContext(options);

    logInfo(ctx, `Starting deployment for component at ${ctx.componentPath}`);

    // 1. Read and resolve devfile
    const devfilePath = await DevfileResolver.resolveDevfilePath(ctx.componentPath);
    if (!devfilePath) {
        throw new Error(`No devfile found in ${ctx.componentPath}`);
    }

    logInfo(ctx, `Found devfile: ${devfilePath}`);

    const raw = await fs.readFile(devfilePath, 'utf-8');
    const sourceDevfile = yaml.load(raw) as Data;

    // 2. Resolve parent chain and inline resources
    logInfo(ctx, 'Resolving devfile parent chain...');
    const resolver = new DevfileResolver();
    const resolvedDevfile = await resolver.resolve(sourceDevfile, {
        devfilePath,
        inlineResources: true,
        logger: options.logger
    });

    logInfo(ctx, 'Devfile resolved and resources inlined');

    // 3. Apply variable overrides if provided
    if (options.variables) {
        resolvedDevfile.variables = {
            ...resolvedDevfile.variables,
            ...options.variables,
        };
    }

    // 4. Find deploy commands
    const deployCommands = findDeployCommands(resolvedDevfile);

    if (deployCommands.length === 0) {
        throw new Error('No deploy commands found in devfile');
    }

    logInfo(ctx, `Found ${deployCommands.length} deploy command(s)`);

    // 5. Separate apply commands (unified script) from exec commands (run after)
    const componentName = resolvedDevfile.metadata.name;
    ApplyCommandExecutor.resetImageNameMap();

    const contributions: DeployScriptContribution[] = [];
    const execCommands: Command[] = [];
    const deployedCommands: string[] = [];

    for (let i = 0; i < deployCommands.length; i++) {
        const cmd = deployCommands[i];
        if (cmd.apply) {
            const contribution = await ApplyCommandExecutor.prepareScript(
                componentFolder, cmd.id, cmd.apply, i + 1, deployCommands.length,
            );
            contributions.push(contribution);
            deployedCommands.push(cmd.id);
        } else {
            execCommands.push(cmd);
        }
    }

    // 6. Build combined script and run in a single terminal
    const allResources: DeployedResource[] = [];
    const allTempFiles: string[] = [];
    let registryKey = '';

    const scriptLines: string[] = [
        `printf "\\x1b[1m↪ Deploying component: ${componentName}\\x1b[0m\\n"`,
        'echo ""',
    ];

    let pullSecretWarning = '';

    for (const c of contributions) {
        scriptLines.push(...c.scriptLines);
        allTempFiles.push(...c.tempFiles);
        allResources.push(...c.resources);
        if (c.registryKey) {
            registryKey = c.registryKey;
        }
        if (c.pullSecretWarning) {
            pullSecretWarning = c.pullSecretWarning;
        }
    }

    scriptLines.push(
        'printf "\\x1b[32m✓ Deployment complete\\x1b[0m\\n"',
    );

    if (pullSecretWarning) {
        scriptLines.push(
            'echo ""',
            `printf "\\x1b[33m⚠  No image pull secret found for ${pullSecretWarning}.\\x1b[0m\\n"`,
            'printf \'\\x1b[33m   If your registry is private, the deployment will fail to pull the image.\\x1b[0m\\n\'',
            'printf \'\\x1b[33m   Make sure your registry is publicly accessible, or create\\x1b[0m\\n\'',
            'printf \'\\x1b[33m   an image pull secret manually in your namespace.\\x1b[0m\\n\'',
        );
    }

    const tempScript = fileSync({ prefix: 'deploy-', postfix: '.sh' });
    await fs.writeFile(tempScript.name, `#!/bin/sh\nset -e\n${scriptLines.join('\n')}`, 'utf-8');
    allTempFiles.push(tempScript.name);

    const command = new CommandText('/bin/sh', tempScript.name);

    logInfo(ctx, `↪ Deploying component: ${componentName}`);

    // 7. Run the unified terminal
    let terminalOutput = '';

    await new Promise<void>((resolve, reject) => {
        void OpenShiftTerminalManager.getInstance().createTerminal(
            command,
            `Deploy: ${componentName}`,
            componentFolder.contextPath,
            process.env,
            {
                onText(text: string) {
                    terminalOutput += text;
                },
                onExit(exitCode: number) {
                    for (const f of allTempFiles) {
                        void fs.unlink(f).catch(() => {});
                    }

                    if (registryKey && /unauthorized|authentication required|denied/i.test(terminalOutput)) {
                        void TokenStore.setItem('registry', registryKey, '').then(() => {
                            void window.showErrorMessage(
                                'Push failed: authentication error. Saved credentials have been cleared. Please retry the deploy.',
                            );
                        });
                    }

                    if (exitCode !== 0) {
                        reject(new Error('Deploy script failed — check the terminal output for details'));
                    } else {
                        resolve();
                    }
                },
            },
        ).catch(reject);
    });

    // 8. Run exec commands after terminal completes (if any)
    for (const cmd of execCommands) {
        try {
            await DevfileCommandRunner.execute(componentFolder, cmd.id);
            deployedCommands.push(cmd.id);
        } catch (err) {
            logError(ctx, `  ✗ Command '${cmd.id}' failed: ${err.message}`);
            throw err;
        }
    }

    // 9. Save deployment state
    const kc = new KubeConfig();
    kc.loadFromDefault();
    const clusterServer = kc.getCurrentCluster()?.server || 'unknown';
    const namespace = await Oc.Instance.getActiveProject() || 'default';

    await saveDeployState({
        version: 1,
        componentName,
        deployedAt: new Date().toISOString(),
        platform: await isOpenShiftCluster() ? 'openshift' : 'kubernetes',
        cluster: clusterServer,
        namespace,
        resources: allResources,
    }, ctx.componentPath);

    logInfo(ctx, `✓ Deployment complete (${deployedCommands.length} commands, ${allResources.length} resources)`);

    return {
        componentName,
        deployedCommands,
        deployedResources: allResources,
        success: true,
    };
}

export function findDeployCommands(devfile: Data): Command[] {
    const commands = devfile.commands || [];

    const compositeDeployCmd = commands.find(cmd =>
        cmd.composite?.group?.kind === 'deploy'
    );

    if (compositeDeployCmd) {
        const subCommandIds = compositeDeployCmd.composite.commands;
        return subCommandIds
            .map(id => commands.find(cmd => cmd.id === id))
            .filter((cmd): cmd is Command => cmd !== undefined);
    }

    return commands.filter(cmd => {
        if (cmd.exec?.group?.kind === 'deploy') return true;
        if (cmd.apply?.group?.kind === 'deploy') return true;
        return false;
    });
}

type DeployContext = {
    componentPath: string;
    options: ComponentDeployOptions;
};

function createDeployContext(options: ComponentDeployOptions): DeployContext {
    return {
        componentPath: path.resolve(options.componentPath),
        options,
    };
}

function logInfo(ctx: DeployContext, message: string) {
    try {
        ctx.options.logger?.info(message);
    } catch (err) {
        // Silently ignore logger errors
    }
}

function logError(ctx: DeployContext, message: string) {
    try {
        ctx.options.logger?.error(message);
    } catch (err) {
        // Silently ignore logger errors
    }
}

export function deployContextKey(clusterServer: string, namespace: string): string {
    return `${clusterServer}/${namespace}`;
}

async function saveDeployState(state: DeployState, componentPath: string): Promise<void> {
    const odoDir = path.join(componentPath, '.odo');
    await fs.mkdir(odoDir, { recursive: true });

    const stateFile = path.join(odoDir, 'deploystate.json');

    let file: DeployStateFile = { version: 2, deployments: {} };
    try {
        const raw = await fs.readFile(stateFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.version === 1 && !parsed.deployments) {
            const key = deployContextKey(parsed.cluster, parsed.namespace);
            file = { version: 2, deployments: { [key]: parsed } };
        } else if (parsed.deployments) {
            file = parsed;
        }
    } catch {
        // no existing file
    }

    const key = deployContextKey(state.cluster, state.namespace);
    file.deployments[key] = state;
    file.version = 2;

    await fs.writeFile(stateFile, JSON.stringify(file, null, 2), 'utf-8');
}
