import { Progress } from "../util/progress";
import * as Odo from "../odo";
import { QuickPickItem } from "vscode";
import * as common from './common';

export namespace Command {
   export function deploy(build: string) {
        return `oc rollout latest dc/${build}`;
    }

    export function getDeploymentConfigs() {
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