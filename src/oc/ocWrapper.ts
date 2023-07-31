/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubernetesObject } from '@kubernetes/client-node/dist/types';
import { CommandOption, CommandText } from '../base/command';
import { CliChannel } from '../cli';

/**
 * Returns the oc command to list all resources of the given type in the given (or current) namespace
 *
 * @param resourceType the resource type to get
 * @param namespace the namespace from which to get all the stateful sets
 * @returns the oc command to list all resources of the given type in the given (or current) namespace
 */
function getKubernetesObjectCommand(resourceType: string, namespace?: string): CommandText {
    if (!resourceType) {
        throw new Error('Must pass the resource type to get');
    }
    const args = [new CommandOption('-o', 'json')];
    if (namespace) {
        args.push(new CommandOption('--namespace', namespace));
    }
    return new CommandText('oc get', resourceType, args);
}

function deleteKubernetesObjectCommand(
    resourceType: string,
    resourceName: string,
    namespace?: string,
): CommandText {
    if (!resourceType || !resourceName) {
        throw new Error('Must pass the resource type and resource name');
    }
    const args = [];
    if (namespace) {
        args.push(new CommandOption('--namespace', namespace));
    }
    return new CommandText('oc delete', `${resourceType} ${resourceName}`, args);
}

function ocExposeCommand(resourceName: string): CommandText {
    return new CommandText('oc expose svc', resourceName);
}

/**
 * Wraps `oc`. It's a class so that it can be stubbed in unit tests.
 */
export class Oc {
    private static INSTANCE = new Oc();

    static get Instance() {
        return Oc.INSTANCE;
    }

    /**
     * Returns a list of all resources of the given type in the given namespace.
     *
     * If no namespace is supplied, the current namespace is used.
     *
     * @param resourceType the type of resource to get a list of
     * @param namespace the namespace to list the resources of (defaults to the current namespace if none is provided)
     * @returns a list of all resources of the given type in the given namespace
     */
    public async getKubernetesObject(
        resourceType: string,
        namespace?: string,
    ): Promise<KubernetesObject[]> {
        const result = await CliChannel.getInstance().executeTool(
            getKubernetesObjectCommand(resourceType, namespace),
        );
        return JSON.parse(result.stdout).items;
    }

    /**
     * Delete the given Kubernetes resource
     *
     * @param resourceType the type of the Kubernetes resource to delete
     * @param resourceName the name of the Kubernetes resource to delete
     * @param namespace the namespace that the Kubernetes resource to delete is in. If not provided, the current namespace will be used
     */
    public async deleteKubernetesObject(
        resourceType: string,
        resourceName: string,
        namespace?: string,
    ) {
        await CliChannel.getInstance().executeTool(
            deleteKubernetesObjectCommand(resourceType, resourceName, namespace),
        );
    }

    /**
     * Expose the given service as a Route.
     *
     * @throws Error if the service doesn't exist
     * @param serviceName the name of the service to expose as a route
     */
    public async exposeServiceAsRoute(serviceName: string): Promise<void> {
        await this.checkForService(serviceName);
        await CliChannel.getInstance().executeTool(ocExposeCommand(serviceName));
    }

    private async checkForService(resourceName: string): Promise<void> {
        const services = await this.getKubernetesObject('service');
        if (!services.some((service) => service.metadata.name === resourceName)) {
            throw new Error(`The resource ${resourceName} has no corresponding service to expose`);
        }
    }
}
