/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window } from 'vscode';
import OpenShiftItem from './openshiftItem';
import { OpenShiftObject, OpenShiftProject, getInstance } from '../odo';
import { Progress } from '../util/progress';
import { vsCommand, VsCommandError } from '../vscommand';

export class Project extends OpenShiftItem {

    @vsCommand('openshift.project.set', true)
    static async set(): Promise<string | null> {
        let message = null;
        const project = await window.showQuickPick((await getInstance().getProjects()).filter((prj: OpenShiftProject) => !prj.active), {placeHolder: 'Select a Project to activate'});
        if (project) {
            await Project.odo.execute(`odo project set ${project.getName()}`);
            Project.explorer.refresh();
            message = `Project '${project.getName()}' set as active.`;
        }
        return message;
    }

    @vsCommand('openshift.project.create')
    static async create(): Promise<string> {
        const projectList: Array<OpenShiftObject> = await OpenShiftItem.odo.getProjects();
        let projectName = await Project.getName('Project name', projectList);
        if (!projectName) return null;
        projectName = projectName.trim();
        return Project.odo.createProject(projectName)
            .then(() => `Project '${projectName}' successfully created`)
            .catch((error) => Promise.reject(new VsCommandError(`Failed to create Project with error '${error}'`)));
    }

    @vsCommand('openshift.project.delete', true)
    static async del(context: OpenShiftObject): Promise<string> {
        let result: Promise<string> = null;
        const project = await Project.getOpenShiftCmdData(context);
        if (project) {
            const value = await window.showWarningMessage(`Do you want to delete Project '${project.getName()}'?`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                result = Progress.execFunctionWithProgress(`Deleting Project '${project.getName()}'`,
                    () => Project.odo.deleteProject(project)
                        .then(async () => {
                            const p = await Project.odo.getProjects();
                            if (p.length>0) {
                                // this changes kubeconfig and that triggers full tree refresh
                                // there is no need to call explorer.refresh() manully
                                await Project.odo.execute(`odo project set ${p[0].getName()}`);
                                Project.explorer.refresh();
                            }
                        })
                        .then(() => `Project '${project.getName()}' successfully deleted`)
                        .catch((err) => Promise.reject(new VsCommandError(`Failed to delete Project with error '${err}'`)))
                );
            }
        }
        return result;
    }
}
