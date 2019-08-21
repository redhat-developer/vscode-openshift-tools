import { Progress } from "../util/progress";
import * as Odo from "../odo";
import { QuickPickItem } from "vscode";
import * as common from './common';
import { ClusterExplorerV1 } from 'vscode-kubernetes-tools-api';

export class DeploymentConfigNodeContributor implements ClusterExplorerV1.NodeContributor {
    contributesChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): boolean {
        return !!parent && parent.nodeType === 'resource' && parent.resourceKind.manifestKind === 'DeploymentConfig';
    }

    async getChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<ClusterExplorerV1.Node[]> {
        return common.getNode(Command.getAllReplicas(parent), 'Deploy', 'deploy');
    }
}

export class Command {
    static getAllReplicas(parent: ClusterExplorerV1.ClusterExplorerNode) {
        return `get rc -o jsonpath="{range .items[?(.metadata.annotations.openshift\\.io/deployment-config\\.name=='${(parent as any).name}')]}{.metadata.namespace}{','}{.metadata.name}{','}{.metadata.annotations.openshift\\.io/deployment-config\\.latest-version}{\\"\\n\\"}{end}"`;
    }

    static deploy(build: string) {
        return `oc rollout latest dc/${build}`;
    }

    static getDeploymentConfigs() {
        return `oc get deploymentConfig -o json`;
    }
}

async function getDeploymentConfigNames(msg: string): Promise<QuickPickItem[]> {
        return common.getQuickPicks(Command.getDeploymentConfigs(), msg);
    }

export async function deploy(context: { id: any; }): Promise<string> {
    let deployName: string = context ? context.id : undefined;
    let result: Promise<string> = null;
    if (!deployName) deployName = await common.selectResourceByName(getDeploymentConfigNames("You have no DeploymentConfigs available to deploy"), "Select a DeploymentConfig to deploy");
    if (deployName) {
        result = Progress.execFunctionWithProgress(`Creating Deployment for '${deployName}'.`, () => Odo.getInstance().execute(Command.deploy(deployName)))
            .then(() => `Deployment successfully created for '${deployName}'.`)
            .catch((err) => Promise.reject(`Failed to create Deployment with error '${err}'.`));
    }
    return result;
}