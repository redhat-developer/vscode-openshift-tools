/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { QuickPickItem, window } from "vscode";
import { ClusterExplorerV1 } from 'vscode-kubernetes-tools-api';
import { Progress } from "../util/progress";
import * as common from './common';
import { OdoImpl, Odo } from "../odo";

export class DeploymentConfig {

    public static command = {
        getReplicationControllers(parent: ClusterExplorerV1.ClusterExplorerNode): string {
            return `get rc -o jsonpath="{range .items[?(.metadata.annotations.openshift\\.io/deployment-config\\.name=='${(parent as any).name}')]}{.metadata.namespace}{','}{.metadata.name}{','}{.metadata.annotations.openshift\\.io/deployment-config\\.latest-version}{\\"\\n\\"}{end}"`;
        },
        deploy(build: string): string {
            return `oc rollout latest dc/${build}`;
        },
        getDeploymentConfigs(): string {
            return `oc get deploymentConfig -o json`;
        },
        showDeploymentConfigLog(deploymentConfig: string): string {
            return `oc logs dc/${deploymentConfig}`;
        },
        getReplicas(deploymentConfig: string): string {
            return `oc get rc -o jsonpath="{range .items[?(.metadata.annotations.openshift\\.io/deployment-config\\.name=='${deploymentConfig}')]}{.metadata.name}{\\"\\n\\"}{end}"`;
        },
        delete(replica: string): string {
            return `oc delete rc ${replica}`;
        },
        showLog(replica: string): string {
            return `oc logs rc/${replica}`;
        }
    };

    protected static readonly odo: Odo = OdoImpl.Instance;

    static async getDeploymentConfigNames(msg: string): Promise<QuickPickItem[]> {
        return common.getQuickPicks(DeploymentConfig.command.getDeploymentConfigs(), msg);
    }

    static getNodeContributor(): ClusterExplorerV1.NodeContributor {
      return {
        contributesChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): boolean {
          return !!parent && parent.nodeType === 'resource' && parent.resourceKind.manifestKind === 'DeploymentConfig';
        },

        async getChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<ClusterExplorerV1.Node[]> {
          return common.getChildrenNode(DeploymentConfig.command.getReplicationControllers(parent), 'ReplicationController', 'rc');
        }
      };
    }

    static async deploy(context: { name: string }): Promise<string> {
        let deployName: string = context ? context.name : undefined;
        let result: Promise<string> = null;
        if (!deployName) deployName = await common.selectResourceByName(DeploymentConfig.getDeploymentConfigNames("You have no DeploymentConfigs available to deploy"), "Select a DeploymentConfig to deploy");
        if (deployName) {
            result = Progress.execFunctionWithProgress(`Creating Deployment for '${deployName}'.`, () => DeploymentConfig.odo.execute(DeploymentConfig.command.deploy(deployName)))
                .then(() => `Deployment successfully created for '${deployName}'.`)
                .catch((err) => Promise.reject(Error(`Failed to create Deployment with error '${err}'.`)));
        }
        return result;
    }

    static async getReplicasList(cmd: string): Promise<string[]> {
        const result = await DeploymentConfig.odo.execute(cmd);
        const replica: string = result.stdout;
        const replicationList = replica.split("\n");
        return replicationList;
    }

    static async getReplicaNames(deploymentConfig: string): Promise<string[]> {
        return DeploymentConfig.getReplicasList(
          DeploymentConfig.command.getReplicas(deploymentConfig));
    }

    static async rcShowLog(context: { impl: any }): Promise<string> {
        const replica = await DeploymentConfig.selectReplica(context, "Select a Replica to see the logs");
        if (replica) {
            DeploymentConfig.odo.executeInTerminal(DeploymentConfig.command.showLog(replica));
        }
        return replica;
    }

    static async showLog(context: { name: string }): Promise<string> {
        let deployName: string = context ? context.name : null;
        if (!deployName) deployName = await common.selectResourceByName(DeploymentConfig.getDeploymentConfigNames("You have no DeploymentConfigs available to see logs"), "Select a DeploymentConfig to see logs");
        if (deployName) {
            DeploymentConfig.odo.executeInTerminal(DeploymentConfig.command.showDeploymentConfigLog(deployName));
        }
        return deployName;
    }

    static async selectReplica(context: { impl: any }, replicaPlaceHolder: string): Promise<string> {
        let replica: string = null;
        if (context) {
            replica = context.impl.name;
        } else {
            const deploymentConfig = await common.selectResourceByName(this.getDeploymentConfigNames("You have no DeploymentConfigs available"), "Select a DeploymentConfig to see the Replica");
            if (!deploymentConfig) return null;
            const selreplica = await window.showQuickPick(this.getReplicaNames(deploymentConfig), {placeHolder: replicaPlaceHolder, ignoreFocusOut: true});
            replica = selreplica || null;
        }
        return replica;
    }

    static async delete(context: { impl: any }): Promise<string> {
        let result: null | string | Promise<string> | PromiseLike<string> = null;
        const replica = await DeploymentConfig.selectReplica(context, "Select a Replica to delete");
        if (replica) {
            result = Progress.execFunctionWithProgress(`Deleting replica`, () => DeploymentConfig.odo.execute(DeploymentConfig.command.delete(replica)))
                .then(() => `Replica '${replica}' successfully deleted`)
                .catch((err) => Promise.reject(Error(`Failed to delete replica with error '${err}'`)));
        }
        return result;
    }
}
