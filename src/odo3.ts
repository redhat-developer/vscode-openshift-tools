/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubernetesObject } from '@kubernetes/client-node';
import { CommandText } from './base/command';
import { CliChannel } from './cli';
import { Command as CommonCommand, loadItems } from './k8s/common';
import { DeploymentConfig } from './k8s/deploymentConfig';
import { Command as DeploymentCommand } from './k8s/deployment';
import { ComponentDescription } from './odo/componentTypeDescription';
import { Command } from './odo/command';

export interface Odo3 {
    getNamespaces(): Promise<KubernetesObject[]>;
    getDeployments(): Promise<KubernetesObject[]>;
    getDeploymentConfigs(): Promise<KubernetesObject[]>;
    describeComponent(contextPath: string): Promise<ComponentDescription | undefined>;
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
}

export function newInstance(): Odo3 {
    return new Odo3Impl();
}
