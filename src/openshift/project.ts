/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject, OpenShiftObjectImpl, Command, ContextType } from '../odo';
import * as vscode from 'vscode';
import { Progress } from '../util/progress';
import { activate } from '../extension';

export class Project extends OpenShiftItem {

    static async create(): Promise<string> {
        const projectList: Array<OpenShiftObject> = await OpenShiftItem.odo.getProjects();
        let projectName = await Project.getName('Project name', projectList);
        if (!projectName) return null;
        projectName = projectName.trim();
        let obj;
        return Project.odo.execute(Command.createProject(projectName))
            .then(async () => {
                const parent = await Project.explorer.getRoot();
                obj = new OpenShiftObjectImpl(parent[0], projectName, ContextType.PROJECT, Project.odo);
                Project.explorer.insert(undefined, obj);
            })
            .then(() => activate['treeView'].reveal(obj, {expand: true}))
            .then(() => `Project '${projectName}' successfully created`)
            .catch((error) => Promise.reject(`Failed to create Project with error '${error}'`));
    }

    static async del(context: OpenShiftObject): Promise<string> {
        let result: Promise<string> = null;
        const project = await Project.getOpenShiftCmdData(context,
            "Select Project to delete"
        );
        if (project) {
            const value = await vscode.window.showWarningMessage(`Do you want to delete Project '${project.getName()}'?`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                result = Progress.execFunctionWithProgress(`Deleting Project '${project.getName()}'`,
                    (progress) => Project.odo.execute(Command.deleteProject(project.getName()))
                        .then(() => Project.odo.execute(Command.waitForProjectToBeGone(project.getName()), process.cwd(), false))
                        .then(() => Project.explorer.refresh())
                        .then(() => `Project '${project.getName()}' successfully deleted`)
                        .catch((err) => Promise.reject(`Failed to delete Project with error '${err}'`))
                );
            }
        }
        return result;
    }
}