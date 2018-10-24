import { OpenShiftObject, Odo, OdoImpl } from '../odo';
import * as vscode from 'vscode';
import { CliExitData } from '../cli';

export class Url {
    private static odo: Odo = OdoImpl.getInstance();

    static async create(context: OpenShiftObject): Promise<string> {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        const portsResult: CliExitData = await Url.odo.execute(`oc get service ${context.getName()}-${app.getName()} -o jsonpath="{range .spec.ports[*]}{.port}{','}{end}"`);
        let ports: string[] = portsResult.stdout.trim().split(',');
        ports = ports.slice(0, ports.length-1);
        let port: string = ports[0];
        if (ports.length > 1) {
            port = await vscode.window.showQuickPick(ports, {placeHolder: "Select port to expose"});
        }
        return Promise.resolve()
        .then(async () => {
            await Url.odo.execute(`odo project set ${project.getName()} && odo app set ${app.getName()} && odo component set ${context.getName()} && odo url create --port ${port}`);
            return `URL for component '${context.getName()}' successfully created`;
        })
        .catch((err) => {
            return Promise.reject(`Failed to create URL for component '${context.getName()}'`);
        });
    }
}