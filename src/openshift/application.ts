import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject } from '../odo';
import * as vscode from 'vscode';
import * as validator from 'validator';

export class Application extends OpenShiftItem {
    static async create(project: OpenShiftObject): Promise<String> {
        const applicationName = await vscode.window.showInputBox({
            prompt: "Application name",
            validateInput: (value: string) => {
                if (validator.isEmpty(value.trim())) {
                    return 'Empty application name';
                }
            }
        });
        if (!applicationName) return Promise.resolve(null);
        return Promise.resolve()
            .then(() => Application.odo.execute(`odo project set ${project.getName()} && odo app create ${applicationName.trim()}`))
            .then(() => {
                Application.explorer.refresh(project);
                return `Application '${applicationName}' successfully created`;
            })
            .catch((error) => { return Promise.reject(`Failed to create application with error '${error}'`); });
    }

    static describe(treeItem: OpenShiftObject): void {
        const project: OpenShiftObject = treeItem.getParent();
        Application.odo.executeInTerminal(`odo project set ${project.getName()}; odo app describe ${treeItem.getName()}`, process.cwd());
    }

    static async delApplication () {
        const projects: OpenShiftObject[] = await Application.odo.getProjects();
        const project = await vscode.window.showQuickPick(projects, {placeHolder: "From which project you want to delete Application"});
        const applications: OpenShiftObject[] = await Application.odo.getApplications(project);
        const application = await vscode.window.showQuickPick(applications, {placeHolder: "Select Application to delete"});
        if (application) {
            return Application.delApplicationByName(application.getName(), project).then(() => Application.explorer.refresh());
        }
    }

    static async del(treeItem: OpenShiftObject): Promise<string> {
        return Application.delApplicationByName(treeItem.getName(), treeItem.getParent());
    }

    static async delApplicationByName(name: string, project: OpenShiftObject): Promise<string> {
        const value = await vscode.window.showWarningMessage(`Are you sure you want to delete application '${name}?'`, 'Yes', 'Cancel');
        if (value === 'Yes') {
            return Promise.resolve()
            .then(() => Application.odo.execute(`odo project set ${project.getName()} && odo app delete ${name} -f`))
            .then(() => Application.explorer.refresh(project))
            .then(() => `Application '${name}' successfully deleted`)
            .catch((err) => Promise.reject(`Failed to delete application with error '${err}'`));
        }
        return Promise.resolve(null);
    }
}

interface OpenShiftQuickPickItem extends vscode.QuickPickItem {
    data: OpenShiftObject;
}