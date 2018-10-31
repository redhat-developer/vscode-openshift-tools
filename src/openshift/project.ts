import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject } from '../odo';
import * as vscode from 'vscode';
import { OpenShiftExplorer } from '../explorer';
import * as validator from 'validator';

export class Project extends OpenShiftItem {

    static async create(): Promise<string> {
        const projectName = await vscode.window.showInputBox({
            prompt: "Mention Project name",
            validateInput: (value: string) => {
                return Project.validateName(value);
            }
        });
        if (!projectName) return Promise.resolve(null);
        return Promise.resolve()
            .then(() => Project.odo.execute(`odo project create ${projectName.trim()}`))
            .then(() => {
                Project.explorer.refresh();
                return `Project '${projectName}' successfully created`;
            })
            .catch((error) => { return Promise.reject(`Failed to create project with error '${error}'`); });
    }

    static async delProject () {
        const projects: OpenShiftObject[] = await Project.odo.getProjects();
        const projectsNames: string[] = projects.map((value)=> value.getName());
        const selected = await vscode.window.showQuickPick(projectsNames, {placeHolder: "Select Project to delete"});
        if (selected) {
            return Project.delProjectByName(selected);
        }
    }

    static async del(context: OpenShiftObject): Promise<string> {
        return Project.delProjectByName(context.getName());
    }

    static async delProjectByName(name: string): Promise<string> {
        const value = await vscode.window.showWarningMessage(`Are you sure you want to delete project '${name}'?`, 'Yes', 'Cancel');
        if (value === 'Yes') {
            return Promise.resolve()
                .then(() => Project.odo.execute(`odo project delete ${name} -f`))
                .then(() => {
                    Project.explorer.refresh();
                    return `Project '${name}' successfully deleted`;
                })
                .catch((err) => { return Promise.reject(`Failed to delete project with error '${err}'`); });
        }
        return Promise.resolve(null);
    }

    private static validateName(value: string) {
        if (validator.isEmpty(value.trim())) {
            return 'Empty project name';
        } else if (!validator.isAlphanumeric(value.trim())) {
            return 'Project name should be alphanumeric';
        } else if (!validator.isLength(value.trim(), 0, 63)) {
            return 'Project name is to long';
        }
    }
}