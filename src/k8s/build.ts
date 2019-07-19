import { window } from "vscode";
import { OdoImpl, Odo } from "../odo";
import { Progress } from "../util/progress";

export class Command {

    static startBuild(comp: string) {
        return `oc start-build ${comp}`;
    }

    static getBuild(build: string) {
        return `oc get build -l buildconfig=${build} -o json`;
    }

    static showLog(text: string, build: string) {
        return `oc logs ${text}${build}`;
    }

    static rebuild(build, build1) {
        return `oc start-build ${build} --from-build ${build1}`;
    }

    static followLog(text: string) {
        return `oc logs -f ${text}`;
    }

    static delete(build: String) {
        return `oc delete ${this.delete}`;
    }

    static buildConfig() {
        return `oc get buildConfig -o json`;
    }
}

export class Build {
    protected static readonly odo: Odo = OdoImpl.Instance;

    static async getBuild(text: string) {
        const buildConfigName = [];
        const buildConfigData = await Build.odo.execute(Command.buildConfig());
        const buildConfigJson: JSON = JSON.parse(buildConfigData.stdout);
        buildConfigJson['items'].forEach((key: any) => {
            buildConfigName.push(key.metadata.name);
        });
        if (buildConfigName.length === 0) throw Error('You have no build available to start');
        return await window.showQuickPick(buildConfigName, {placeHolder: text});
    }

    static async startBuild(context: any) {
        let buildName: string;
        if (context) {
            buildName = context.id;
        } else {
            buildName = await Build.getBuild("Select the build to start");
        }
        if (!buildName) return null;
        return Progress.execFunctionWithProgress(`Starting build`, async () => {
            return Build.odo.execute(Command.startBuild(buildName));
        }).then(() => `Build '${buildName}' successfully started`)
        .catch((err) => Promise.reject(`Failed to start build with error '${err}'`));
    }

    static showLog(context: any) {
        let buildName: string;
        if (context) {
            buildName = context.impl.name;
        } else {

        }
        Build.odo.executeInTerminal(Command.showLog(buildName, '-build'));
    }

    static rebuild(context) {
        let buildName: string;
        if (context) {
            buildName = context.impl.name;
        }
        Build.odo.executeInTerminal(Command.showLog(buildName, '-build'));
    }

    static followLog() {

    }

    static delete() {

    }
}