/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubernetesObject } from '@kubernetes/client-node';
import { commands, window } from 'vscode';
import { OpenShiftExplorer } from '../explorer';
import { Oc } from '../oc/ocWrapper';
import { Progress } from '../util/progress';
import { VsCommandError, vsCommand } from '../vscommand';
import OpenShiftItem from './openshiftItem';
import { KubeConfigUtils } from '../util/kubeUtils';

export class Project extends OpenShiftItem {

    @vsCommand('openshift.project.set', true)
    static async set(): Promise<string | null> {
        let message: string = null;
        const createNewProject = {
            label: 'Create new Project',
            description: 'Create new Project and make it active'
        };
        const projectsAndCreateNew = Oc.Instance
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
            await Oc.Instance.setProject(projectName);
            OpenShiftExplorer.getInstance().refresh();
            Project.serverlessView.refresh();
            message = `Project '${projectName}' set as active.`;
        }
        return message;
    }

    @vsCommand('openshift.project.create')
    static async create(): Promise<string> {
        const projectList = Oc.Instance.getProjects();
        let projectName = await Project.getProjectName('Project name', projectList);
        if (!projectName) return null;
        projectName = projectName.trim();
        return Oc.Instance.createProject(projectName)
            .then(() => {
                const kcu = new KubeConfigUtils();
                const currentContext = kcu.findContext(kcu.currentContext);
                if (currentContext && projectName === currentContext.namespace) {
                    // We have to force refresh on App Explorer in case of the new project name
                    // is the same as the one set in current context (active project) because,
                    // in case they are equal, the kube config will not be changed by `odo creare project`,
                    // so the App Explorer will not be automatcally refreshed whle it really needs to be
                    // refreshed
                    OpenShiftExplorer.getInstance().refresh();
                }
                return `Project '${projectName}' successfully created`;
            })
            .catch((error) => Promise.reject(new VsCommandError(`Failed to create Project with error '${error}'`, 'Failed to create Project')));
    }

    @vsCommand('openshift.project.delete', true)
    static async del(project: KubernetesObject): Promise<string> {
        let result: Promise<string> = null;

        const isProjectEmpty = (await Oc.Instance.getAllKubernetesObjects(project.metadata.name)).length === 0;

        const value = await window.showWarningMessage(`Do you want to delete Project '${project.metadata.name}'${!isProjectEmpty ? ' and all its contents' : ''}?`, 'Yes', 'Cancel');
        if (value === 'Yes') {
            result = Progress.execFunctionWithProgress(
                `Deleting Project '${project.metadata.name}'`,
                async () => {
                    // migrate to odo3.ts
                    const projects = await Oc.Instance.getProjects();
                    const selectedProject = projects.find(p => p.name === project.metadata.name);
                    await Oc.Instance.deleteProject(selectedProject.name);
                    OpenShiftExplorer.getInstance().refresh();
                })
                .catch((err) => Promise.reject(new VsCommandError(`Failed to delete Project with error '${err}'`,'Failed to delete Project')))
                .then(() => `Project '${project.metadata.name}' successfully deleted`);
        }
        return result;
    }

}
