/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { OpenshiftLogger } from '../util/childProcessUtil';
import { ComponentWorkspaceFolder } from '../odo/workspace';
import { Data, Command, DeployedResource, DeployState } from '../odo/componentTypeDescription';
import { DevfileResolver } from './devfileResolver';
import { DevfileCommandRunner } from './devfileCommandRunner';
import { ApplyCommandExecutor } from './applyCommand';

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
        inlineResources: true,  // Inline URIs from local files or URLs
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

    // 5. Execute each deploy command (idempotent - safe to retry)
    const deployedCommands: string[] = [];
    const allDeployedResources: DeployedResource[] = [];

    for (const cmd of deployCommands) {
        logInfo(ctx, `Executing deploy command: ${cmd.id}`);

        try {
            // Execute command and collect deployed resources
            if (cmd.apply) {
                const resources = await ApplyCommandExecutor.execute(componentFolder, cmd.id, cmd.apply);
                allDeployedResources.push(...resources);
            } else {
                // Composite or other command types
                await DevfileCommandRunner.execute(componentFolder, cmd.id);
            }

            deployedCommands.push(cmd.id);
            logInfo(ctx, `✓ Command '${cmd.id}' completed`);
        } catch (err) {
            logError(ctx, `✗ Command '${cmd.id}' failed: ${err.message}`);
            logError(ctx, 'Deployment can be retried - oc apply is idempotent');
            throw err;
        }
    }

    // 6. Save deployment state
    await saveDeployState({
        version: 1,
        componentName: resolvedDevfile.metadata.name,
        deployedAt: new Date().toISOString(),
        platform: 'cluster',  // TODO: detect podman vs cluster
        resources: allDeployedResources,
    }, ctx.componentPath);

    logInfo(ctx, 'Deployment completed successfully');

    return {
        componentName: resolvedDevfile.metadata.name,
        deployedCommands,
        deployedResources: allDeployedResources,
        success: true,
    };
}

function findDeployCommands(devfile: Data): Command[] {
    return (devfile.commands || []).filter(cmd => {
        // Commands with group.kind === 'deploy'
        if (cmd.exec?.group?.kind === 'deploy') return true;
        if (cmd.composite?.group?.kind === 'deploy') return true;
        if (cmd.apply) return true;  // All apply commands are deploy commands

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

async function saveDeployState(state: DeployState, componentPath: string): Promise<void> {
    const odoDir = path.join(componentPath, '.odo');
    await fs.mkdir(odoDir, { recursive: true });

    const stateFile = path.join(odoDir, 'deploystate.json');
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2), 'utf-8');
}
