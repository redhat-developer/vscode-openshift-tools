/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as path from 'path';
import { OpenshiftLogger } from '../util/childProcessUtil';
import { ComponentWorkspaceFolder } from '../odo/workspace';
import { DeployState } from '../odo/componentTypeDescription';
import { Oc } from '../oc/ocWrapper';

export interface ComponentUndeployOptions {
    componentPath: string;
    logger?: OpenshiftLogger;
    force?: boolean;  // Delete even if tracking data missing
}

export async function undeployComponent(
    options: ComponentUndeployOptions,
    componentFolder: ComponentWorkspaceFolder
): Promise<void> {
    const ctx = createUndeployContext(options);

    logInfo(ctx, `Starting undeploy for component at ${ctx.componentPath}`);

    const stateFile = path.join(ctx.componentPath, '.odo', 'deploystate.json');

    // 1. Try to load deploy state
    const deployState = await loadDeployState(stateFile);

    if (deployState) {
        logInfo(ctx, `Found deployment state with ${deployState.resources.length} tracked resources`);

        // 2. Delete tracked resources in reverse order (idempotent)
        await deleteTrackedResources(deployState, ctx);

        // 3. Delete deploy state file
        try {
            await fs.unlink(stateFile);
            logInfo(ctx, 'Deployment state file removed');
        } catch (err) {
            logWarning(ctx, `Failed to remove deployment state file: ${err.message}`);
        }
    } else {
        if (options.force) {
            logInfo(ctx, 'No deployment state found, falling back to label-based cleanup');
            await cleanupByLabels(componentFolder, ctx);
        } else {
            logWarning(ctx, 'No deployment state found. Use force option for label-based cleanup.');
        }
    }

    logInfo(ctx, 'Undeploy completed');
}

async function deleteTrackedResources(deployState: DeployState, ctx: UndeployContext): Promise<void> {
    // Delete in reverse order (Services before Deployments, etc.)
    const resources = [...deployState.resources].reverse();

    for (const resource of resources) {
        try {
            logInfo(ctx, `Deleting ${resource.kind}/${resource.name}`);

            await Oc.Instance.deleteKubernetesObject(
                resource.kind.toLowerCase(),
                resource.name,
                resource.namespace
            );

            logInfo(ctx, `✓ Deleted ${resource.kind}/${resource.name}`);
        } catch (err) {
            // Don't fail entire undeploy if one resource fails
            // User can retry undeploy to clean up remaining resources
            logWarning(ctx, `Failed to delete ${resource.kind}/${resource.name}: ${err.message}`);
        }
    }
}

async function cleanupByLabels(
    componentFolder: ComponentWorkspaceFolder,
    ctx: UndeployContext
): Promise<void> {
    const componentName = componentFolder.component.devfileData.devfile.metadata.name;

    logInfo(ctx, `Cleaning up resources for component: ${componentName}`);

    const labelSelectors = [
        `app.kubernetes.io/instance=${componentName}`,
        `app.kubernetes.io/component=${componentName}`,
        `component=${componentName}`,
    ];

    const resourceTypes = [
        'deployment',
        'service',
        'route',
        'ingress',
        'configmap',
        'secret',
        'pvc',
    ];

    for (const selector of labelSelectors) {
        for (const resourceType of resourceTypes) {
            try {
                const resources = await Oc.Instance.getKubernetesObjects(
                    resourceType,
                    undefined,
                    selector
                );

                for (const resource of resources) {
                    // Skip dev mode resources (check for dev-specific labels)
                    if (isDevResource(resource)) {
                        logInfo(ctx, `Skipping dev resource: ${resourceType}/${resource.metadata.name}`);
                        continue;
                    }

                    try {
                        await Oc.Instance.deleteKubernetesObject(
                            resourceType,
                            resource.metadata.name
                        );
                        logInfo(ctx, `Deleted ${resourceType}/${resource.metadata.name}`);
                    } catch (err) {
                        logWarning(ctx, `Failed to delete ${resourceType}/${resource.metadata.name}: ${err.message}`);
                    }
                }
            } catch {
                // Resource type might not exist or not accessible, ignore
            }
        }
    }
}

function isDevResource(resource: any): boolean {
    // Check for dev mode indicators
    const labels = resource.metadata?.labels || {};
    return (
        labels['odo.dev/mode'] === 'dev' ||
        labels['controller.devfile.io/devworkspace_id'] !== undefined
    );
}

async function loadDeployState(stateFile: string): Promise<DeployState | null> {
    try {
        const content = await fs.readFile(stateFile, 'utf-8');
        return JSON.parse(content) as DeployState;
    } catch {
        return null;
    }
}

type UndeployContext = {
    componentPath: string;
    options: ComponentUndeployOptions;
};

function createUndeployContext(options: ComponentUndeployOptions): UndeployContext {
    return {
        componentPath: path.resolve(options.componentPath),
        options,
    };
}

function logInfo(ctx: UndeployContext, message: string) {
    try {
        ctx.options.logger?.info(message);
    } catch (err) {
        // Silently ignore logger errors
    }
}

function logWarning(ctx: UndeployContext, message: string) {
    try {
        ctx.options.logger?.error(message);
    } catch (err) {
        // Silently ignore logger errors
    }
}
