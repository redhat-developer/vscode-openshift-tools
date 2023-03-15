/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubernetesObject } from '@kubernetes/client-node';
import { CommandText } from './base/command';
import { CliChannel, CliExitData } from './cli';
import { Command as CommonCommand, loadItems } from './k8s/common';
import { Command as DeploymentCommand } from './k8s/deployment';
import { DeploymentConfig } from './k8s/deploymentConfig';
import { Command } from './odo/command';
import { ComponentDescription } from './odo/componentTypeDescription';

export interface Odo3 {
    getNamespaces(): Promise<KubernetesObject[]>;
    getDeployments(): Promise<KubernetesObject[]>;
    getDeploymentConfigs(): Promise<KubernetesObject[]>;

    setNamespace(newNamespace: string): Promise<void>;

    describeComponent(contextPath: string): Promise<ComponentDescription | undefined>;

    /**
     * Bind a component to a bindable service by modifying the devfile
     *
     * Resolves when the binding it created.
     *
     * @param contextPath the path to the component
     * @param serviceName the name of the service to bind to
     * @param serviceNamespace the namespace the the service is in
     * @param bindingName the name of the service binding
     */
    addBinding(
        contextPath: string,
        serviceName: string,
        serviceNamespace: string,
        bindingName: string,
    ): Promise<void>;

    /**
     * Returns a list of all the bindable services on the cluster.
     *
     * @returns a list of all the bindable services on the cluster
     */
    getBindableServices(): Promise<KubernetesObject[]>;
}

export class Odo3Impl implements Odo3 {

    private async getListItems<T>(command: CommandText, fail = false) {
        const listCliExitData = await CliChannel.getInstance().executeTool(command, undefined, fail);
        const result = loadItems<T>(listCliExitData.stdout);
        return result;
    }

    async getDeployments(): Promise<KubernetesObject[]> {
        return this.getListItems<KubernetesObject>(DeploymentCommand.get());
    }

    async getDeploymentConfigs(): Promise<KubernetesObject[]> {
        return this.getListItems<KubernetesObject>(DeploymentConfig.command.getDeploymentConfigs());
    }

    async getProjectResources() {
        return this.getListItems<KubernetesObject>(CommonCommand.getResourceList('project'), true);
    }

    async getNamespacesResources() {
        return this.getListItems<KubernetesObject>(CommonCommand.getResourceList('namespace'), true);
    }

    async getNamespaces(): Promise<KubernetesObject[]> {
        return Promise.any([
            this.getProjectResources(),
            this.getNamespacesResources()
        ]);
    }

    async setNamespace(newNamespace: string): Promise<void> {
        await CliChannel.getInstance().executeTool(
            Command.setNamespace(newNamespace), undefined, true
        );
    }

    public async describeComponent(contextPath: string): Promise<ComponentDescription | undefined> {
        try {
            const describeCmdResult = await CliChannel.getInstance().executeTool(
                Command.describeComponentJson(), {cwd: contextPath}, false
            );
            return JSON.parse(describeCmdResult.stdout) as ComponentDescription;
        } catch(error) {
            // ignore and return undefined
        }
    }

    async addBinding(contextPath: string, serviceNamespace: string, serviceName: string, bindingName: string) {
        const myCommand = Command.addBinding(serviceNamespace, serviceName, bindingName);
        await CliChannel.getInstance().executeTool(
            myCommand,
            {cwd: contextPath},
            true
        );
    }

    async getBindableServices(): Promise<KubernetesObject[]> {
        const data: CliExitData = await CliChannel.getInstance().executeTool(
            Command.getBindableServices()
        );
        let responseObj;
        try {
            responseObj = JSON.parse(data.stdout);
        } catch {
            throw new Error(JSON.parse(data.stderr).message);
        }
        if (!responseObj.bindableServices) {
            return [];
        }
        return (responseObj.bindableServices as BindableService[]) //
            .map(obj => {
                return {
                    kind: obj.kind,
                    apiVersion: obj.apiVersion,
                    metadata: {
                        namespace: obj.namespace,
                        name: obj.name,
                    }
                } as KubernetesObject;
            });
    }
}

interface BindableService {
    name: string;
    namespace: string;
    kind: string;
    apiVersion: string;
    service: string;
}

export function newInstance(): Odo3 {
    return new Odo3Impl();
}
