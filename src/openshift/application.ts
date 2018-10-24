import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject } from '../odo';
import * as vscode from 'vscode';

export class Application extends OpenShiftItem {
    static async create(context: OpenShiftObject): Promise<String> {
        const applicationName = await vscode.window.showInputBox({
            prompt: "Application name",
            validateInput: (value: string) => {
                if (value.trim().length === 0) {
                    return 'Empty application name';
                }
            }
        });
        if (!applicationName) return Promise.resolve(null);
        return Promise.resolve()
            .then(() => Application.odo.execute(`odo project set ${context.getName()} && odo app create ${applicationName.trim()}`))
            .then(() => {
                Application.explorer.refresh(context);
                return `Application '${applicationName}' successfully created`;
            })
            .catch((error) => { return Promise.reject(`Failed to create application with error '${error}'`); });
    }

    static describe(context: OpenShiftObject): void {
        const project: OpenShiftObject = context.getParent();
        Application.odo.executeInTerminal(`odo project set ${project.getName()}; odo app describe ${context.getName()}`, process.cwd());
    }

    static async del(context: OpenShiftObject): Promise<string> {
        const project: OpenShiftObject = context.getParent();
        const value = await vscode.window.showWarningMessage(`Are you sure you want to delete application '${context.getName()}?`, 'Yes', 'Cancel');
        if (value === 'Yes') {
            return Promise.resolve()
            .then(() => Application.odo.execute(`odo project set ${project.getName()} && odo app delete ${context.getName()} -f`))
            .then(() => {
                Application.explorer.refresh(context.getParent());
                return `Application '${context.getName()}' successfully deleted`;
            })
            .catch((err)=> { return Promise.reject(`Failed to delete application with error '${err}'`); });
        }
        return Promise.resolve(null);
    }
}