/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubernetesObject } from '@kubernetes/client-node';
import { Disposable, commands, window } from 'vscode';
import { OpenShiftExplorer } from '../explorer';
import { Oc } from '../oc/ocWrapper';
import { KubeConfigInfo, getNamespaceKind } from '../util/kubeUtils';
import { Progress } from '../util/progress';
import { VsCommandError, vsCommand } from '../vscommand';
import OpenShiftItem from './openshiftItem';

export class Project extends OpenShiftItem implements Disposable {
    private static instance: Project;

    public static getInstance(): Project {
        if (!Project.instance) {
            Project.instance = new Project();
        }
        return Project.instance;
    }

    dispose() { }

    @vsCommand('openshift.project.set', true)
    @vsCommand('openshift.namespace.set', true)
    static async set(): Promise<string | null> {
        let message: string = null;
        const kind = await getNamespaceKind();
        const oc = Oc.Instance;
        const canCreateProjects = await oc.canCreateNamespace();
        const canListProjects = await oc.canListNamespaces();

        const createNewProject = {
            label: `Create new ${kind}`,
            description: `Create new ${kind} and make it active`
        };
        const manuallySetProject = {
            label: `Manually set active ${kind}`,
            description: `Type in ${kind} name and make it active`
        };
        const projectsAndCreateNew = oc.getProjects() //
            .then((projects) => {
                const items = [];
                if (canCreateProjects) {
                    items.push(createNewProject);
                }
                items.push(manuallySetProject);
                if (canListProjects) {
                    items.push(...projects.map((project) => ({
                        label: project.name,
                        description: project.active ? 'Currently active': '',
                    })));
                }
                return items;
            });
        const selectedItem = await window.showQuickPick(projectsAndCreateNew, {placeHolder: `Select ${kind} to activate or create new one`});
        if (!selectedItem) return null;
        if (selectedItem === createNewProject) {
            await commands.executeCommand('openshift.project.create');
        } else {
            const projectName = selectedItem === manuallySetProject ?
                await Project.getProjectName(`${kind} name`, Promise.resolve([])) : selectedItem.label;
            if (!projectName) return null;

            await oc.setProject(projectName);
            OpenShiftExplorer.getInstance().refresh();
            Project.serverlessView.refresh();
            message = `${kind} '${projectName}' set as active.`;
        }
        return message;
    }

    @vsCommand('openshift.project.create')
    @vsCommand('openshift.namespace.create')
    static async create(): Promise<string> {
        const kind = await getNamespaceKind();
        const oc = Oc.Instance;
        const projectList = oc.getProjects(true);
        let projectName = await Project.getProjectName(`${kind} name`, projectList);
        if (!projectName) return null;
        projectName = projectName.trim();
        return oc.createProject(projectName)
            .then(() => {
                const k8sConfigInfo = new KubeConfigInfo();
                const currentContext = k8sConfigInfo.findContext(k8sConfigInfo.getEffectiveKubeConfig().currentContext);
                if (currentContext && projectName === currentContext.namespace) {
                    // We have to force refresh on App Explorer in case of the new project name
                    // is the same as the one set in current context (active project) because,
                    // in case they are equal, the kube config will not be changed by `odo creare project`,
                    // so the App Explorer will not be automatcally refreshed whle it really needs to be
                    // refreshed
                    OpenShiftExplorer.getInstance().refresh();
                }
                return `${kind} '${projectName}' successfully created`;
            })
            .catch((error) => Promise.reject(new VsCommandError(`Failed to create ${kind} with error '${error}'`, `Failed to create ${kind}`)));
    }

    @vsCommand('openshift.project.delete.palette', true)
    @vsCommand('openshift.namespace.delete.palette', true)
    static async delFromPalette(): Promise<string | null> {
        const kind = await getNamespaceKind();
        const oc = Oc.Instance;
        const projects = oc.getProjects(true) // Get only projects existing on cluster
            .then((projects) => [
                ...projects.map((project) => ({
                    label: project.name,
                    description: project.active ? 'Currently active': '',
                })),
            ]);
        const selectedItem = await window.showQuickPick(projects, {placeHolder: `Select ${kind} to delete`});
        if (!selectedItem) return null;
        return Project.del({
                kind: 'project',
                metadata: {
                    name: selectedItem.label,
                },
            } as KubernetesObject
        );
    }

    @vsCommand('openshift.project.delete', false)
    @vsCommand('openshift.namespace.delete', false)
    static async del(project: KubernetesObject, context?: { oc?: Oc }): Promise<string> {
        let result: Promise<string> = null;
        const oc = context?.oc ?? Oc.Instance;
        const projectObjects = await oc.getAllKubernetesObjects(project.metadata.name);
        const isProjectEmpty = !projectObjects || projectObjects.length === 0;
        const kind = await getNamespaceKind();
        const value = await window.showWarningMessage(`Do you want to delete ${kind} '${project.metadata.name}'${!isProjectEmpty ? ' and all its contents' : ''}?`, 'Yes', 'Cancel');
        if (value === 'Yes') {
            result = Progress.execFunctionWithProgress(
                `Deleting ${kind} '${project.metadata.name}'`,
                async () => {
                    // migrate to odo3.ts
                    const projects = await oc.getProjects();
                    const selectedProject = projects.find(p => p.name === project.metadata.name);
                    if (selectedProject) {
                        await oc.deleteProject(selectedProject.name);
                    } else {
                        throw Error(`${kind} to delete not found: ${project.metadata.name}`)
                    }
                    OpenShiftExplorer.getInstance().refresh();
                })
                .catch((err) => Promise.reject(new VsCommandError(`Failed to delete ${kind} with error '${err}'`, `Failed to delete ${kind}`)))
                .then(() => `${kind} '${project.metadata.name}' successfully deleted`);
        }
        return result;
    }
}
