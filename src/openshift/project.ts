/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject } from '../odo';
import { Progress } from '../util/progress';
import { window } from 'vscode';

export class Project extends OpenShiftItem {

    static async create(): Promise<string> {
        const projectList: Array<OpenShiftObject> = await OpenShiftItem.odo.getProjects();
        let projectName = await Project.getName('Project name', projectList);
        if (!projectName) return null;
        projectName = projectName.trim();
        return Project.odo.createProject(projectName)
            .then(() => `Project '${projectName}' successfully created`)
            .catch((error) => Promise.reject(`Failed to create Project with error '${error}'`));
    }

    static async del(context: OpenShiftObject): Promise<string> {
        let result: Promise<string> = null;
        const project = await Project.getOpenShiftCmdData(context,
            "Select Project to delete"
        );
        if (project) {
            const value = await window.showWarningMessage(`Do you want to delete Project '${project.getName()}'?`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                result = Progress.execFunctionWithProgress(`Deleting Project '${project.getName()}'`,
                    () => Project.odo.deleteProject(project)
                        .then(() => `Project '${project.getName()}' successfully deleted`)
                        .catch((err) => Promise.reject(`Failed to delete Project with error '${err}'`))
                );
            }
        }
        return result;
    }
}