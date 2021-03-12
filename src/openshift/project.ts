/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { commands, QuickPickItem, window } from 'vscode';
import OpenShiftItem, { clusterRequired } from './openshiftItem';
import { OpenShiftObject, OpenShiftProject, getInstance as getOdoInstance } from '../odo';
import { Progress } from '../util/progress';
import { vsCommand, VsCommandError } from '../vscommand';

export class Project extends OpenShiftItem {

    @vsCommand('openshift.project.set', true)
    @clusterRequired()
    static async set(): Promise<string | null> {
        let message = null;
        const createNewProject = {
            label: 'Create new Project',
            description: 'Create new Project and make it active'
        };
        const projectsAndCommand = getOdoInstance().getProjects()
            .then((projects) =>projects.filter((prj: OpenShiftProject) => !prj.active))
            .then((projects: (QuickPickItem | OpenShiftObject)[]) => {
                return [createNewProject, ...projects];
            });
        const selectedItem = await window.showQuickPick(projectsAndCommand, {placeHolder: 'Select Project to activate or create new one'});
        if (!selectedItem) return null;
        if (selectedItem === createNewProject) {
            await commands.executeCommand('openshift.project.create');
        } else {
            const project = selectedItem as OpenShiftObject;
            await Project.odo.execute(`odo project set ${project.getName()}`);
            Project.explorer.refresh();
            message = `Project '${project.getName()}' set as active.`;
        }
        return message;
    }

    @vsCommand('openshift.project.create')
    @clusterRequired()
    static async create(): Promise<string> {
        const projectList = OpenShiftItem.odo.getProjects();
        let projectName = await Project.getName('Project name', projectList);
        if (!projectName) return null;
        projectName = projectName.trim();
        return Project.odo.createProject(projectName)
            .then(() => `Project '${projectName}' successfully created`)
            .catch((error) => Promise.reject(new VsCommandError(`Failed to create Project with error '${error}'`, 'Failed to create Project')));
    }

    @vsCommand('openshift.project.delete', true)
    @clusterRequired()
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
                            }
                        })
                        .then(() => `Project '${project.getName()}' successfully deleted`)
                        .catch((err) => Promise.reject(new VsCommandError(`Failed to delete Project with error '${err}'`,'Failed to delete Project')))
                );
            }
        }
        return result;
    }
}
