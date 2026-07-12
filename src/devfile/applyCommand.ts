/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { window } from 'vscode';
import { CommandText } from '../base/command';
import { DownloadUtil } from '../downloadUtil/download';
import { Oc } from '../oc/ocWrapper';
import { Apply, DeployedResource } from '../odo/componentTypeDescription';
import { ComponentWorkspaceFolder } from '../odo/workspace';
import { ContainerRuntimeDetector } from '../util/containerRuntime';
import { OpenShiftTerminalManager } from '../webview/openshift-terminal/openShiftTerminal';
import { VariableResolver } from './variableResolver';

export class ApplyCommandExecutor {
    public static async execute(
        componentFolder: ComponentWorkspaceFolder,
        commandId: string,
        apply: Apply,
    ): Promise<DeployedResource[]> {
        const devfile = componentFolder.component.devfileData.devfile;
        const devfilePath = componentFolder.component.devfilePath;

        // 1. Resolve variables in apply command
        const resolvedApply = VariableResolver.resolveApply(devfile, apply);

        // 2. Find the kubernetes component
        const component = devfile.components?.find((c) => c.name === resolvedApply.component);

        if (!component) {
            throw new Error(`Component '${resolvedApply.component}' not found in devfile`);
        }

        // 3. Apply kubernetes/openshift resources OR build images
        if (component.kubernetes) {
            return await this.applyKubernetesComponent(
                devfile,
                component.kubernetes,
                path.dirname(devfilePath),
                commandId,
            );
        }
        if ((component as any).openshift) {
            // OpenShift components use same structure as kubernetes
            return await this.applyKubernetesComponent(
                devfile,
                (component as any).openshift,
                path.dirname(devfilePath),
                commandId,
            );
        }
        if ((component as any).image) {
            return await this.buildImageComponent(
                (component as any).image,
                path.dirname(devfilePath),
                componentFolder,
            );
        }
        throw new Error(
            `Component '${resolvedApply.component}' is not a kubernetes, openshift, or image component`,
        );
    }

    private static async applyKubernetesComponent(
        devfile: any,
        k8sComponent: any,
        devfileDir: string,
        commandId: string,
    ): Promise<DeployedResource[]> {
        let manifestContent: string;

        // Load manifest content from inlined YAML or URI
        if (k8sComponent.inlined) {
            manifestContent = k8sComponent.inlined;
        } else if (k8sComponent.uri) {
            // Resolve variables in URI first
            const resolvedUri = VariableResolver.resolveValue(devfile, k8sComponent.uri);
            manifestContent = await this.loadManifestFromUri(resolvedUri, devfileDir);
        } else {
            throw new Error('Kubernetes component must have either inlined or uri specified');
        }

        // Resolve variables in the manifest content
        const resolvedManifest = VariableResolver.resolveKubernetesContent(
            devfile,
            manifestContent,
        );

        // Apply to cluster using existing Oc wrapper (idempotent)
        try {
            await Oc.Instance.applyConfiguration(resolvedManifest);
            void window.showInformationMessage(`Applied resources for command '${commandId}'`);
        } catch (err) {
            throw new Error(
                `Failed to apply Kubernetes resources: ${err.message}\n` +
                    'Deployment can be retried - oc apply is idempotent.',
            );
        }

        // Parse and return deployed resources for tracking
        return this.parseDeployedResources(resolvedManifest);
    }

    private static async loadManifestFromUri(
        uri: string,
        devfileDir: string,
    ): Promise<string> {
        // Handle HTTP/HTTPS URLs
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
            return this.downloadManifest(uri);
        }

        // Handle file paths (relative or absolute)
        const manifestPath = path.isAbsolute(uri) ? uri : path.join(devfileDir, uri);

        try {
            return await fs.readFile(manifestPath, 'utf-8');
        } catch (err) {
            throw new Error(`Failed to read manifest file '${manifestPath}': ${err.message}`);
        }
    }

    private static async downloadManifest(url: string): Promise<string> {
        const tempFile = path.join(require('os').tmpdir(), `manifest-${Date.now()}.yaml`);

        try {
            await DownloadUtil.downloadFile(url, tempFile);
            const content = await fs.readFile(tempFile, 'utf-8');
            await fs.unlink(tempFile);
            return content;
        } catch (err) {
            // Cleanup on error
            try {
                await fs.unlink(tempFile);
            } catch {
                // Ignore cleanup errors
            }
            throw new Error(`Failed to download manifest from '${url}': ${err.message}`);
        }
    }

    private static async buildImageComponent(
        imageComponent: any,
        devfileDir: string,
        componentFolder: ComponentWorkspaceFolder,
    ): Promise<DeployedResource[]> {
        const runtime = await ContainerRuntimeDetector.detectBuildRuntime();
        if (!runtime) {
            throw new Error(
                'No container runtime found. Install podman, docker, or buildah to build images.',
            );
        }

        const imageName = imageComponent.imageName;
        const dockerfilePath = imageComponent.dockerfile?.uri || 'Dockerfile';
        const buildContext = imageComponent.dockerfile?.buildContext || '.';

        // Resolve paths relative to devfile directory
        const resolvedDockerfile = path.isAbsolute(dockerfilePath)
            ? dockerfilePath
            : path.join(devfileDir, dockerfilePath);
        const resolvedContext = path.isAbsolute(buildContext)
            ? buildContext
            : devfileDir;

        const buildArgs = ContainerRuntimeDetector.getBuildCommand(
            runtime, imageName, resolvedDockerfile, resolvedContext,
        );

        // Run build in terminal - allows interactive auth for registry push
        const command = new CommandText(runtime, buildArgs.slice(runtime.length + 1));

        return new Promise<DeployedResource[]>((resolve, reject) => {
            void OpenShiftTerminalManager.getInstance().createTerminal(
                command,
                `Build: ${imageName}`,
                componentFolder.contextPath,
                process.env,
                {
                    onExit() {
                        resolve([]);
                    },
                },
            ).catch(reject);
        });
    }

    private static parseDeployedResources(manifestContent: string): DeployedResource[] {
        const resources: DeployedResource[] = [];
        const timestamp = new Date().toISOString();

        try {
            // Parse YAML (can contain multiple documents)
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
            // Silently ignore parsing errors
        }

        return resources;
    }
}
