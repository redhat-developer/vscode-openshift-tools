import { window } from "vscode";
import { OdoImpl, Odo } from "../odo";

export class Command {

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
}

export class Build {
    protected static readonly odo: Odo = OdoImpl.Instance;

    static showLog(context: any) {
        let buildName: string;
        if (context) {
            buildName = context.impl.name;
        } else {

        }
        Build.odo.executeInTerminal(Command.showLog(buildName, '-build'));
    }
}