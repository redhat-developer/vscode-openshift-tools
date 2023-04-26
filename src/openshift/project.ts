/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubernetesObject } from '@kubernetes/client-node';
import { commands, window } from 'vscode';
import { CommandOption, CommandText } from '../base/command';
import { CliChannel } from '../cli';
import { OpenShiftExplorer } from '../explorer';
import { getInstance as getOdoInstance } from '../odo';
import { Progress } from '../util/progress';
import { VsCommandError, vsCommand } from '../vscommand';
import OpenShiftItem from './openshiftItem';

export class Command {
    static listProjects(): CommandText {
        return new CommandText('oc', 'get projects', [new CommandOption('-o', 'jsonpath="{range .items[*]}{.metadata.name}{\'\\n\'}{end}')]);
    }

    static setActiveProject(name: string) {
        return new CommandText('oc', `project ${name}`);
    }

    static deleteProject(name: string) {
        return new CommandText('oc delete project', name, [new CommandOption('--wait=true')])
    }
}

export class Project extends OpenShiftItem {

    @vsCommand('openshift.project.set', true)
    static async set(): Promise<string | null> {
        let message: string = null;
        const createNewProject = {
            label: 'Create new Project',
            description: 'Create new Project and make it active'
        };
        const projectsAndCreateNew = getOdoInstance()
            .getProjects() //
            .then((projects) => [
                createNewProject,
                ...projects.map((project) => ({
                    label: project.name,
                    description: project.active ? 'Currently active': '',
                })),
            ]);
        const selectedItem = await window.showQuickPick(projectsAndCreateNew, {placeHolder: 'Select Project to activate or create new one'});
        if (!selectedItem) return null;
        if (selectedItem === createNewProject) {
            await commands.executeCommand('openshift.project.create');
        } else {
            const projectName = selectedItem.label;
            await CliChannel.getInstance().executeTool(Command.setActiveProject(projectName));
            Project.explorer.refresh();
            message = `Project '${projectName}' set as active.`;
        }
        return message;
    }

    @vsCommand('openshift.project.create')
    static async create(): Promise<string> {
        const projectList = OpenShiftItem.odo.getProjects();
        let projectName = await Project.getProjectName('Project name', projectList);
        if (!projectName) return null;
        projectName = projectName.trim();
        return Project.odo.createProject(projectName)
            .then(() => `Project '${projectName}' successfully created`)
            .catch((error) => Promise.reject(new VsCommandError(`Failed to create Project with error '${error}'`, 'Failed to create Project')));
    }

    @vsCommand('openshift.project.delete', true)
    static async del(project: KubernetesObject): Promise<string> {
        let result: Promise<string> = null;

        const value = await window.showWarningMessage(`Do you want to delete Project '${project.metadata.name}'?`, 'Yes', 'Cancel');
        if (value === 'Yes') {
            result = Progress.execFunctionWithProgress(
                `Deleting Project '${project.metadata.name}'`,
                async () => {
                    // migrate to odo3.ts
                    const projects = await getOdoInstance().getProjects();
                    const selectedProject = projects.find(p => p.name === project.metadata.name);
                    await getOdoInstance().deleteProject(selectedProject.name);
                    OpenShiftExplorer.getInstance().refresh();
                })
                .catch((err) => Promise.reject(new VsCommandError(`Failed to delete Project with error '${err}'`,'Failed to delete Project')))
                .then(() => `Project '${project.metadata.name}' successfully deleted`);
        }
        return result;
    }

}
