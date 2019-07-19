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
        return `oc delete build ${build}`;
    }

    static buildConfig() {
        return `oc get buildConfig -o json`;
    }

    static getParentBuild(childBuild: string) {
        return `oc get build ${childBuild} -o jsonpath="{.metadata.labels['buildconfig']}"`;
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
        if (context) buildName = context.id;
        else buildName = await Build.getBuild("Select the build to start");
        if (!buildName) return null;
        return Progress.execFunctionWithProgress(`Starting build`, async () => {
            return Build.odo.execute(Command.startBuild(buildName));
        }).then(() => `Build '${buildName}' successfully started`)
        .catch((err) => Promise.reject(`Failed to start build with error '${err}'`));
    }

    static async getAllBuild(text: string) {
        const buildName = [];
        const build = await Build.getBuild("select the build");
        if (!build) return null;
        const getBuild =  await Build.odo.execute(Command.getBuild(build));
        const buildJson: JSON = JSON.parse(getBuild.stdout);
        buildJson['items'].forEach(element => {
            buildName.push(element.metadata.name);
        });
        if (buildName.length === 0) throw Error('You have no build available');
        return await window.showQuickPick(buildName, {placeHolder: text});
    }

    static async showLog(context: any) {
        let buildName: string;
        if (context) {
            buildName = context.impl.name;
        } else {
            const build = await Build.getAllBuild("select the build too see the logs");
            if (!build) return null;
            else buildName = build;
        }
        Build.odo.executeInTerminal(Command.showLog(buildName, '-build'));
    }

    static async rebuild(context) {
        let buildName: string;
        let parentBuild: string;
        if (context) {
            buildName = context.impl.name;
            const getParentBuild = await Build.odo.execute(Command.getParentBuild(buildName));
            parentBuild = getParentBuild.stdout;
        } else {
            buildName = await Build.getAllBuild("select too rebuild");
            if (!buildName) return null;
            const getParentBuild = await Build.odo.execute(Command.getParentBuild(buildName));
            parentBuild = getParentBuild.stdout;
        }
        Build.odo.executeInTerminal(Command.rebuild(parentBuild, buildName));
    }

    static async followLog(context) {
        let buildName: string;
        if (context) {
            buildName = context.impl.name;
        } else {
            const build = await Build.getAllBuild("select the build too see the logs");
            if (!build) return null;
            else buildName = build;
        }
        Build.odo.executeInTerminal(Command.showLog(buildName, '-build'));
    }

    static async delete(context) {
        let buildName;
        if (context) {
            buildName = context.impl.name;
        } else {
            const build = await Build.getAllBuild("select the build too delete");
            if (!build) return null;
            else buildName = build;
        }
        return Progress.execFunctionWithProgress(`Starting build`, async () => {
            return Build.odo.execute(Command.delete(buildName));
        }).then(() => `Build '${buildName}' successfully deleted`)
        .catch((err) => Promise.reject(`Failed to delete build with error '${err}'`));

    }
}