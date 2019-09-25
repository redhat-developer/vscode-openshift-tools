import { Progress } from "../util/progress";
import { QuickPickItem, window } from "vscode";
import * as common from './common';
import { ClusterExplorerV1 } from 'vscode-kubernetes-tools-api';
import { OdoImpl, Odo } from "../odo";

export class Command {
    static getReplicationControllers(parent: ClusterExplorerV1.ClusterExplorerNode) {
        return `get rc -o jsonpath="{range .items[?(.metadata.annotations.openshift\\.io/deployment-config\\.name=='${(parent as any).name}')]}{.metadata.namespace}{','}{.metadata.name}{','}{.metadata.annotations.openshift\\.io/deployment-config\\.latest-version}{\\"\\n\\"}{end}"`;
    }

    static getDeploymentConfigState(deploymentConfig: string) {
        return `oc get dc/${deploymentConfig} -o jsonpath={".spec.paused"}`;
    }

    static pause(deploymentConfig: string) {
        return `oc rollout pause dc ${deploymentConfig}`;
    }

    static resume(deploymentConfig: string) {
        return `oc rollout resume dc ${deploymentConfig}`;
    }

    static deploy(build: string) {
        return `oc rollout latest dc/${build}`;
    }

    static getDeploymentConfigs() {
        return `oc get deploymentConfig -o json`;
    }

    static showDeploymentConfigLog(deploymentConfig: string) {
        return `oc logs dc/${deploymentConfig}`;
    }

    static getReplicas(deploymentConfig: string) {
        return `oc get rc -o jsonpath="{range .items[?(.metadata.annotations.openshift\\.io/deployment-config\\.name=='${deploymentConfig}')]}{.metadata.name}{\\"\\n\\"}{end}"`;
    }

    static delete(replica: String) {
        return `oc delete rc ${replica}`;
    }

    static showLog(replica: string) {
        return `oc logs rc/${replica}`;
    }
}

export class DeploymentConfigNodeContributor implements ClusterExplorerV1.NodeContributor {
    contributesChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): boolean {
        return !!parent && parent.nodeType === 'resource' && parent.resourceKind.manifestKind === 'DeploymentConfig';
    }

    async getChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<ClusterExplorerV1.Node[]> {
        return common.getChildrenNode(Command.getReplicationControllers(parent), 'ReplicationController', 'rc');
    }
}

export class DeploymentConfig {
    protected static readonly odo: Odo = OdoImpl.Instance;

    static async getDeploymentConfigNames(msg: string): Promise<QuickPickItem[]> {
        return common.getQuickPicks(Command.getDeploymentConfigs(), msg);
    }

    static async deploy(context: { name: string; }): Promise<string> {
        let deployName: string = context ? context.name : undefined;
        const deploymentStatus = await DeploymentConfig.getDeploymentConfigState(deployName);
        if (deploymentStatus) throw await window.showWarningMessage(`${deployName} is paused. This will stop any new rollouts or triggers from running until resumed.`);
        let result: Promise<string> = null;
        if (!deployName) deployName = await common.selectResourceByName(DeploymentConfig.getDeploymentConfigNames("You have no DeploymentConfigs available to deploy"), "Select a DeploymentConfig to deploy");
        if (deployName) {
            result = Progress.execFunctionWithProgress(`Creating Deployment for '${deployName}'.`, () => DeploymentConfig.odo.execute(Command.deploy(deployName)))
                .then(() => `Deployment successfully created for '${deployName}'.`)
                .catch((err) => Promise.reject(`Failed to create Deployment with error '${err}'.`));
        }
        return result;
    }

    static async pause(context: { name: string; }): Promise<string> {
        let deployName: string = context ? context.name : null;
        const deploymentStatus = await DeploymentConfig.getDeploymentConfigState(deployName);
        if (deploymentStatus) throw await window.showWarningMessage(`${deployName} is paused. This will stop any new rollouts or triggers from running until resumed.`);
        window.showWarningMessage(`${deployName} is paused.`);
        if (!deployName) deployName = await common.selectResourceByName(DeploymentConfig.getDeploymentConfigNames("You have no DeploymentConfigs available to pause"), "Select a DeploymentConfig to pause");
        if (deployName) {
            DeploymentConfig.odo.executeInTerminal(Command.pause(deployName));
        }
        return deployName;
    }

    static async getDeploymentConfigState(deploymentConfigName: string, status?: string) {
        const deploymentStatus = await DeploymentConfig.odo.execute(Command.getDeploymentConfigState(deploymentConfigName));
        if (deploymentStatus.stdout === 'true') return true;
        return false;
    }

    static async resume(context: { name: string; }): Promise<string> {
        let deployName: string = context ? context.name : null;
        const deploymentStatus = await DeploymentConfig.getDeploymentConfigState(deployName);
        if (deploymentStatus) {
            window.showWarningMessage(`${deployName} is resume.`);
        } else {
            throw await window.showWarningMessage(`${deployName} is resume.`);
        }
        await DeploymentConfig.getDeploymentConfigState(deployName);
        if (!deployName) deployName = await common.selectResourceByName(DeploymentConfig.getDeploymentConfigNames("You have no DeploymentConfigs available to resume"), "Select a DeploymentConfig to resume");
        if (deployName) {
            DeploymentConfig.odo.executeInTerminal(Command.resume(deployName));
        }
        return deployName;
    }

    static async getReplicasList(cmd: string, errorMessage: string): Promise<string[]> {
        const result = await DeploymentConfig.odo.execute(cmd);
        const replica: string = result.stdout;
        const replicationList = replica.split("\n");
        if (replicationList.length === 0) {
            throw Error(errorMessage);
        }
        return replicationList;
    }

    static async getReplicaNames(deploymentConfig: string): Promise<string[]> {
        return DeploymentConfig.getReplicasList(
            Command.getReplicas(deploymentConfig),
            'You have no replicas available');
    }

    static async rcShowLog(context: { impl: any; }): Promise<string> {
        const replica = await DeploymentConfig.selectReplica(context, "Select a Replica too see the logs");
        if (replica) {
            DeploymentConfig.odo.executeInTerminal(Command.showLog(replica));
        }
        return replica;
    }

    static async showLog(context: { name: string; }): Promise<string> {
        let deployName: string = context ? context.name : null;
        if (!deployName) deployName = await common.selectResourceByName(DeploymentConfig.getDeploymentConfigNames("You have no DeploymentConfigs available to see log's"), "Select a DeploymentConfig too see logs");
        if (deployName) {
            DeploymentConfig.odo.executeInTerminal(Command.showDeploymentConfigLog(deployName));
        }
        return deployName;
    }

    static async selectReplica(context: any, replicaPlaceHolder: string): Promise<string> {
        let replica: string = null;
        if (context) {
            replica = context.impl.name;
        } else {
            const deploymentConfig = await common.selectResourceByName(this.getDeploymentConfigNames("You have no DeploymentConfigs available"), "Select a DeploymentConfig to see the Replica");
            if (!deploymentConfig) return null;
            const selreplica = await window.showQuickPick(this.getReplicaNames(deploymentConfig), {placeHolder: replicaPlaceHolder});
            replica = selreplica ? selreplica : null;
        }
        return replica;
    }

    static async delete(context: { impl: any; }): Promise<string> {
        let result: null | string | Promise<string> | PromiseLike<string> = null;
        const replica = await DeploymentConfig.selectReplica(context, "Select a Replica too delete");
        if (replica) {
            result = Progress.execFunctionWithProgress(`Deleting replica`, () => DeploymentConfig.odo.execute(Command.delete(replica)))
                .then(() => `Replica '${replica}' successfully deleted`)
                .catch((err) => Promise.reject(`Failed to delete replica with error '${err}'`));
        }
        return result;
    }
}