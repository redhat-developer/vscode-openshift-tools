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
import { DownloadUtil } from '../downloadUtil/download';
import { Oc } from '../oc/ocWrapper';
import { KubernetesVariant } from '../oc/types';
import { ToolsConfig } from '../tools';
import { Apply, DeployedResource } from '../odo/componentTypeDescription';
import { detectKubernetesVariant, getOpenShiftRegistryUrl, isOpenShiftCluster } from '../util/kubeUtils';
import { ComponentWorkspaceFolder } from '../odo/workspace';
import { TokenStore } from '../util/credentialManager';
import { ContainerRuntimeDetector } from '../util/containerRuntime';
import { OpenShiftTerminalManager } from '../webview/openshift-terminal/openShiftTerminal';
import { ensurePullSecret, ensureRegistryConfigured, OPENSHIFT_INTERNAL_REGISTRY, rewriteImageName } from './registryConfig';
import { VariableResolver } from './variableResolver';

export function debugEcho(cmd: string): string {
    const masked = cmd
        .replace(/--token[= ]\S+/g, '--token ****')
        .replace(/-p[= ]\S+/g, '-p ****');
    return `printf "\\x1b[2m+ ${masked}\\x1b[0m\\n"`;
}

export interface DeployScriptContribution {
    scriptLines: string[];
    tempFiles: string[];
    resources: DeployedResource[];
    registryKey?: string;
    pullSecretWarning?: string;
}

export class ApplyCommandExecutor {
    private static imageNameMap = new Map<string, string>();
    private static locallyLoadedImages = new Set<string>();

    public static resetImageNameMap(): void {
        this.imageNameMap.clear();
        this.locallyLoadedImages.clear();
    }

    public static async execute(
        componentFolder: ComponentWorkspaceFolder,
        commandId: string,
        apply: Apply,
    ): Promise<DeployedResource[]> {
        const contribution = await this.prepareScript(componentFolder, commandId, apply, 1, 1);

        const scriptLines = [
            ...contribution.scriptLines,
            'echo ""',
            'printf "\\x1b[32m✓ Done\\x1b[0m\\n"',
        ];
        const tempScript = fileSync({ prefix: 'apply-', postfix: '.sh' });
        await fs.writeFile(tempScript.name, `#!/bin/sh\nset -e\n${scriptLines.join('\n')}`, 'utf-8');

        const command = new CommandText('/bin/sh', tempScript.name);

        return new Promise<DeployedResource[]>((resolve, reject) => {
            void OpenShiftTerminalManager.getInstance().createTerminal(
                command,
                `Apply: ${commandId}`,
                componentFolder.contextPath,
                process.env,
                {
                    onExit() {
                        void fs.unlink(tempScript.name).catch(() => {});
                        for (const f of contribution.tempFiles) {
                            void fs.unlink(f).catch(() => {});
                        }
                        resolve(contribution.resources);
                    },
                },
            ).catch(reject);
        });
    }

    public static async prepareScript(
        componentFolder: ComponentWorkspaceFolder,
        commandId: string,
        apply: Apply,
        stepNumber: number,
        totalSteps: number,
    ): Promise<DeployScriptContribution> {
        const devfile = componentFolder.component.devfileData.devfile;
        const devfilePath = componentFolder.component.devfilePath;

        const resolvedApply = VariableResolver.resolveApply(devfile, apply);

        const component = devfile.components?.find((c) => c.name === resolvedApply.component);

        if (!component) {
            throw new Error(`Component '${resolvedApply.component}' not found in devfile`);
        }

        if (component.kubernetes) {
            return await this.prepareApplyScript(
                devfile,
                component.kubernetes,
                path.dirname(devfilePath),
                commandId,
                stepNumber,
                totalSteps,
            );
        }
        if ((component as any).openshift) {
            return await this.prepareApplyScript(
                devfile,
                (component as any).openshift,
                path.dirname(devfilePath),
                commandId,
                stepNumber,
                totalSteps,
            );
        }
        if ((component as any).image) {
            return await this.prepareBuildScript(
                (component as any).image,
                path.dirname(devfilePath),
                stepNumber,
                totalSteps,
            );
        }
        throw new Error(
            `Component '${resolvedApply.component}' is not a kubernetes, openshift, or image component`,
        );
    }

    private static async prepareApplyScript(
        devfile: any,
        k8sComponent: any,
        devfileDir: string,
        commandId: string,
        stepNumber: number,
        totalSteps: number,
    ): Promise<DeployScriptContribution> {
        let manifestContent: string;

        if (k8sComponent.inlined) {
            manifestContent = k8sComponent.inlined;
        } else if (k8sComponent.uri) {
            const resolvedUri = VariableResolver.resolveValue(devfile, k8sComponent.uri);
            manifestContent = await this.loadManifestFromUri(resolvedUri, devfileDir);
        } else {
            throw new Error('Kubernetes component must have either inlined or uri specified');
        }

        let resolvedManifest = VariableResolver.resolveKubernetesContent(
            devfile,
            manifestContent,
        );

        for (const [original, retagged] of this.imageNameMap) {
            resolvedManifest = resolvedManifest.replaceAll(original, retagged);
        }

        let patchedContainers: string[] = [];
        if (this.locallyLoadedImages.size > 0) {
            const result = this.patchImagePullPolicy(resolvedManifest);
            resolvedManifest = result.manifest;
            patchedContainers = result.patchedContainers;
        }

        const resources = this.parseDeployedResources(resolvedManifest);
        const resourceSummary = resources.map(r => `${r.kind}/${r.name}`).join(', ');

        const ocPath = await ToolsConfig.detect('oc');
        if (!ocPath) {
            throw new Error('oc CLI not found. Install or configure the OpenShift CLI tool.');
        }

        const tempFile = fileSync({ prefix: 'manifest-', postfix: '.yaml' });
        await fs.writeFile(tempFile.name, resolvedManifest, 'utf-8');

        const applyCmd = `"${ocPath}" apply --server-side=true -f ${tempFile.name}`;
        const scriptLines = [
            `printf "\\x1b[1m[${stepNumber}/${totalSteps}] Applying Kubernetes resources: ${commandId}\\x1b[0m\\n"`,
            `echo " •  Resources: ${resourceSummary}"`,
        ];
        if (patchedContainers.length > 0) {
            scriptLines.push(
                'printf \'\\x1b[2m ⓘ  Patched imagePullPolicy: IfNotPresent for locally loaded images\\x1b[0m\\n\'',
                `printf "\\x1b[2m    (containers: ${patchedContainers.join(', ')} — prevents pulling from remote registry)\\x1b[0m\\n"`,
            );
        }
        scriptLines.push(
            'echo ""',
            debugEcho(applyCmd),
            applyCmd,
            'echo ""',
            'printf "\\x1b[32m ✓  Resources applied successfully\\x1b[0m\\n"',
            'echo ""',
        );

        return {
            scriptLines,
            tempFiles: [tempFile.name],
            resources,
        };
    }

    private static async loadManifestFromUri(
        uri: string,
        devfileDir: string,
    ): Promise<string> {
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
            return this.downloadManifest(uri);
        }

        const manifestPath = path.isAbsolute(uri) ? uri : path.join(devfileDir, uri);

        try {
            return await fs.readFile(manifestPath, 'utf-8');
        } catch (err) {
            throw new Error(`Failed to read manifest file '${manifestPath}': ${err.message}`);
        }
    }

    private static async downloadManifest(url: string): Promise<string> {
        const tempFile = fileSync({ prefix: 'manifest-', postfix: '.yaml' }).name;

        try {
            await DownloadUtil.downloadFile(url, tempFile);
            const content = await fs.readFile(tempFile, 'utf-8');
            await fs.unlink(tempFile);
            return content;
        } catch (err) {
            try {
                await fs.unlink(tempFile);
            } catch {
                // Ignore cleanup errors
            }
            throw new Error(`Failed to download manifest from '${url}': ${err.message}`);
        }
    }

    private static async prepareBuildScript(
        imageComponent: any,
        devfileDir: string,
        stepNumber: number,
        totalSteps: number,
    ): Promise<DeployScriptContribution> {
        const runtime = await ContainerRuntimeDetector.detectBuildRuntime();
        if (!runtime) {
            throw new Error(
                'No container runtime found. Install podman, docker, or buildah to build images.',
            );
        }

        const imageName = imageComponent.imageName;
        const dockerfilePath = imageComponent.dockerfile?.uri || 'Dockerfile';
        const buildContext = imageComponent.dockerfile?.buildContext || '.';

        const resolvedDockerfile = path.isAbsolute(dockerfilePath)
            ? dockerfilePath
            : path.join(devfileDir, dockerfilePath);
        const resolvedContext = path.isAbsolute(buildContext)
            ? buildContext
            : devfileDir;

        const isOpenShift = await isOpenShiftCluster();
        const k8sVariant = isOpenShift
            ? undefined
            : await detectKubernetesVariant();

        const buildCmd = ContainerRuntimeDetector.getBuildCommand(
            runtime, imageName, resolvedDockerfile, resolvedContext,
        );

        const scriptLines: string[] = [
            `printf "\\x1b[1m[${stepNumber}/${totalSteps}] Building image: ${imageName}\\x1b[0m\\n"`,
            `echo " •  Building image locally using ${runtime}..."`,
            'echo ""',
            debugEcho(buildCmd),
            buildCmd,
            'echo ""',
            'echo " ✓  Image built successfully"',
            'echo ""',
        ];

        let registryKey = '';
        let pullSecretWarning = '';

        if (k8sVariant === KubernetesVariant.Kind) {
            const { KubeConfig } = await import('@kubernetes/client-node');
            const kc = new KubeConfig();
            kc.loadFromDefault();
            const contextName = kc.currentContext;
            const kindClusterName = contextName?.startsWith('kind-')
                ? contextName.slice('kind-'.length)
                : undefined;

            ApplyCommandExecutor.locallyLoadedImages.add(imageName);
            const retagCmd = ContainerRuntimeDetector.getRetagCommand(runtime, imageName);
            const kindLoadCmd = ContainerRuntimeDetector.getKindLoadCommand(runtime, imageName, kindClusterName);
            if (retagCmd) {
                scriptLines.push(
                    `printf "\\x1b[2m ⓘ  Retagging image as docker.io/library/${imageName} (${runtime} uses localhost/ prefix, Kind expects docker.io/library/)\\x1b[0m\\n"`,
                    debugEcho(retagCmd),
                    retagCmd,
                    'echo ""',
                );
            }
            scriptLines.push(
                'echo " •  Loading image into Kind cluster..."',
                'echo ""',
                debugEcho(kindLoadCmd),
                kindLoadCmd,
                'echo ""',
                'echo " ✓  Image loaded into Kind cluster"',
            );
        } else if (k8sVariant === KubernetesVariant.Minikube) {
            ApplyCommandExecutor.locallyLoadedImages.add(imageName);
            const retagCmd = ContainerRuntimeDetector.getRetagCommand(runtime, imageName);
            const minikubeLoadCmd = ContainerRuntimeDetector.getMinikubeLoadCommand(runtime, imageName);
            if (retagCmd) {
                scriptLines.push(
                    `printf "\\x1b[2m ⓘ  Retagging image as docker.io/library/${imageName} (${runtime} uses localhost/ prefix, Minikube expects docker.io/library/)\\x1b[0m\\n"`,
                    debugEcho(retagCmd),
                    retagCmd,
                    'echo ""',
                );
            }
            scriptLines.push(
                'echo " •  Loading image into Minikube cluster..."',
                'echo ""',
                debugEcho(minikubeLoadCmd),
                minikubeLoadCmd,
                'echo ""',
                'echo " ✓  Image loaded into Minikube cluster"',
            );
        } else if (isOpenShift) {
            let credentials = await ensureRegistryConfigured(runtime, true);
            if (!credentials) {
                throw new Error('Registry configuration cancelled. Cannot push image without a registry.');
            }

            if (credentials.registry === OPENSHIFT_INTERNAL_REGISTRY) {
                const registryUrl = await getOpenShiftRegistryUrl();
                const namespace = await Oc.Instance.getActiveProject();
                if (registryUrl && namespace) {
                    const targetImage = `${registryUrl}/${namespace}/${imageName}`;
                    ApplyCommandExecutor.imageNameMap.set(imageName, targetImage);

                    const { KubeConfig } = await import('@kubernetes/client-node');
                    const kc = new KubeConfig();
                    kc.loadFromDefault();
                    const user = kc.getCurrentUser();
                    const token = user?.token;
                    if (token) {
                        try {
                            await ContainerRuntimeDetector.loginToRegistry(runtime, registryUrl, 'unused', token);
                        } catch {
                            void window.showWarningMessage(
                                `Failed to log in to OpenShift registry at ${registryUrl}. `
                                + 'Your cluster session token may be expired. '
                                + 'Use the "Log in to Cluster" action in the OpenShift Explorer to refresh your session, then retry the deploy.',
                            );
                            throw new Error(`OpenShift registry login failed for ${registryUrl}`);
                        }
                    }

                    const tagCmd = `${runtime} tag ${imageName} ${targetImage}`;
                    const pushCmd = ContainerRuntimeDetector.getPushCommand(runtime, targetImage);
                    scriptLines.push(
                        `echo " •  Retagging image: ${imageName} → ${targetImage}"`,
                        debugEcho(tagCmd),
                        tagCmd,
                        'echo " •  Pushing image to registry..."',
                        'echo ""',
                        debugEcho(pushCmd),
                        pushCmd,
                        'echo ""',
                        'echo " ✓  Image pushed to OpenShift registry"',
                    );
                } else {
                    throw new Error(
                        'Could not detect OpenShift internal registry URL. '
                        + 'Select an external registry (quay.io, docker.io, etc.) instead.',
                    );
                }
            } else {
                registryKey = `${credentials.registry}/${credentials.username}`;

                if (credentials.password) {
                    let loggedIn = false;
                    while (!loggedIn) {
                        try {
                            await ContainerRuntimeDetector.loginToRegistry(
                                runtime, credentials.registry, credentials.username, credentials.password,
                            );
                            loggedIn = true;
                        } catch {
                            await TokenStore.setItem('registry', registryKey, '');
                            const action = await window.showErrorMessage(
                                `Login to ${credentials.registry} failed. Check your username and password.`,
                                'Retry', 'Cancel',
                            );
                            if (action !== 'Retry') {
                                throw new Error('Registry login cancelled.');
                            }
                            credentials = await ensureRegistryConfigured(runtime, true);
                            if (!credentials) {
                                throw new Error('Registry configuration cancelled.');
                            }
                            registryKey = `${credentials.registry}/${credentials.username}`;
                        }
                    }
                }

                const targetImage = rewriteImageName(imageName, credentials.registry, credentials.username);

                if (targetImage !== imageName) {
                    ApplyCommandExecutor.imageNameMap.set(imageName, targetImage);
                    const tagCmd = `${runtime} tag ${imageName} ${targetImage}`;
                    scriptLines.push(
                        `echo " •  Retagging image: ${imageName} → ${targetImage}"`,
                        debugEcho(tagCmd),
                        tagCmd,
                        'echo ""',
                    );
                }

                const pushCmd = ContainerRuntimeDetector.getPushCommand(runtime, targetImage);
                scriptLines.push(
                    `echo " •  Pushing image to ${credentials.registry}..."`,
                    'echo ""',
                    debugEcho(pushCmd),
                    pushCmd,
                    'echo ""',
                    'echo " ✓  Image pushed to registry"',
                );
                const secretCreated = await ensurePullSecret(
                    credentials.registry, credentials.username, credentials.password,
                );
                if (!secretCreated) {
                    pullSecretWarning = credentials.registry;
                }
            }
        } else {
            let credentials = await ensureRegistryConfigured(runtime);
            if (!credentials) {
                throw new Error('Registry configuration cancelled. Cannot push image without a registry.');
            }

            registryKey = `${credentials.registry}/${credentials.username}`;

            if (credentials.password) {
                let loggedIn = false;
                while (!loggedIn) {
                    try {
                        await ContainerRuntimeDetector.loginToRegistry(
                            runtime, credentials.registry, credentials.username, credentials.password,
                        );
                        loggedIn = true;
                    } catch {
                        await TokenStore.setItem('registry', registryKey, '');
                        const action = await window.showErrorMessage(
                            `Login to ${credentials.registry} failed. Check your username and password.`,
                            'Retry', 'Cancel',
                        );
                        if (action !== 'Retry') {
                            throw new Error('Registry login cancelled.');
                        }
                        credentials = await ensureRegistryConfigured(runtime);
                        if (!credentials) {
                            throw new Error('Registry configuration cancelled.');
                        }
                        registryKey = `${credentials.registry}/${credentials.username}`;
                    }
                }
            }

            const targetImage = rewriteImageName(imageName, credentials.registry, credentials.username);

            if (targetImage !== imageName) {
                ApplyCommandExecutor.imageNameMap.set(imageName, targetImage);
                const tagCmd = `${runtime} tag ${imageName} ${targetImage}`;
                scriptLines.push(
                    `echo " •  Retagging image: ${imageName} → ${targetImage}"`,
                    debugEcho(tagCmd),
                    tagCmd,
                    'echo ""',
                );
            }

            const pushCmd = ContainerRuntimeDetector.getPushCommand(runtime, targetImage);
            scriptLines.push(
                `echo " •  Pushing image to ${credentials.registry}..."`,
                'echo ""',
                debugEcho(pushCmd),
                pushCmd,
                'echo ""',
                'echo " ✓  Image pushed to registry"',
            );
            const secretCreated = await ensurePullSecret(
                credentials.registry, credentials.username, credentials.password,
            );
            if (!secretCreated) {
                pullSecretWarning = credentials.registry;
            }
        }

        scriptLines.push(
            'echo ""',
            'printf "\\x1b[32m ✓  Image delivery complete\\x1b[0m\\n"',
            'echo ""',
        );

        return {
            scriptLines,
            tempFiles: [],
            resources: [],
            registryKey: registryKey || undefined,
            pullSecretWarning: pullSecretWarning || undefined,
        };
    }

    public static patchImagePullPolicy(manifestContent: string): { manifest: string; patchedContainers: string[] } {
        const patchedContainers: string[] = [];
        try {
            const docs = yaml.loadAll(manifestContent);
            const patched = docs.map(doc => {
                if (!doc || typeof doc !== 'object') return doc;

                const patchContainers = (containers: any[], resourceName: string) => {
                    if (!Array.isArray(containers)) return;
                    for (const container of containers) {
                        if (container?.image && this.locallyLoadedImages.has(container.image)) {
                            if (!container.imagePullPolicy || container.imagePullPolicy === 'Always') {
                                container.imagePullPolicy = 'IfNotPresent';
                                patchedContainers.push(`${resourceName}/${container.name}`);
                            }
                        }
                    }
                };

                const d = doc as any;
                const resourceName = `${d.kind || 'unknown'}/${d.metadata?.name || 'unknown'}`;
                const templateSpec = d.spec?.template?.spec;
                if (templateSpec) {
                    patchContainers(templateSpec.containers, resourceName);
                    patchContainers(templateSpec.initContainers, resourceName);
                }
                if (d.kind === 'Pod' && d.spec) {
                    patchContainers(d.spec.containers, resourceName);
                    patchContainers(d.spec.initContainers, resourceName);
                }

                return doc;
            });

            return {
                manifest: patched.map(doc => yaml.dump(doc, { noRefs: true })).join('---\n'),
                patchedContainers,
            };
        } catch {
            return { manifest: manifestContent, patchedContainers };
        }
    }

    public static parseDeployedResources(manifestContent: string): DeployedResource[] {
        const resources: DeployedResource[] = [];
        const timestamp = new Date().toISOString();

        try {
            const docs = yaml.loadAll(manifestContent);

            for (const doc of docs) {
                if (doc && typeof doc === 'object' && 'kind' in doc && 'metadata' in doc) {
                    const metadata = (doc as any).metadata || {};
                    resources.push({
                        kind: (doc as any).kind,
                        name: metadata.name || 'unknown',
                        namespace: metadata.namespace,
                        labels: metadata.labels || {},
                        appliedAt: timestamp,
                    });
                }
            }
        } catch (err) {
            // If parsing fails, return empty array - not critical for deployment
        }

        return resources;
    }
}
