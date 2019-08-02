import { Progress } from "../util/progress";
import { Build } from "./build";
import { Odo, OdoImpl } from "../odo";
import { QuickPickItem } from "vscode";

export class Command {
   static deploy(build: string) {
        return `oc rollout latest dc/${build}`;
    }

    static getDeploymentConfigs() {
        return `oc get deploymentConfig -o json`;
    }
}

export class Deployment {
    protected static readonly odo: Odo = OdoImpl.Instance;

    static async getDeploymentConfigNames(msg: string): Promise<QuickPickItem[]> {
        return Build.getQuickPicks(
            Command.getDeploymentConfigs(),
            msg);
    }

    static async deploymentConfig(context: { id: any; }): Promise<string> {
        let deployName: string = context ? context.id : undefined;
        let result: Promise<string> = null;
        if (!deployName) deployName = await Build.selectBuldConfig(await Deployment.getDeploymentConfigNames("You have no DeploymentConfigs available to deploy"), "Select a DeploymentConfig to deploy");
        if (deployName) {
            result = Progress.execFunctionWithProgress(`Deploying`, () => Deployment.odo.execute(Command.deploy(deployName)))
                .then(() => `Successfully deploy '${deployName}'`)
                .catch((err) => Promise.reject(`Failed to deploy with error '${err}'`));
        }
        return result;
    }
}