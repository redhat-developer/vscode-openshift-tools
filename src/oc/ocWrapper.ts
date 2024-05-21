/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubernetesObject } from '@kubernetes/client-node/dist/types';
import * as fs from 'fs/promises';
import * as tmp from 'tmp';
import { CommandOption, CommandText } from '../base/command';
import { CliChannel } from '../cli';
import { KubeConfigUtils } from '../util/kubeUtils';
import { Platform } from '../util/platform';
import { Project } from './project';
import { ClusterType, KubernetesConsole } from './types';

/**
 * A wrapper around the `oc` CLI tool.
 *
 * This class is a stateless singleton.
 * This makes it easier to stub its methods than if it were a bunch of directly exported functions.
 */
export class Oc {
    private static INSTANCE = new Oc();

    static get Instance() {
        return Oc.INSTANCE;
    }

    /**
     * Returns a list of all resources of the given type in the given namespace.
     *
     * If no namespace is supplied, the current namespace is used.
     *
     * @param resourceType the type of resource to get a list of
     * @param namespace the namespace to list the resources of (defaults to the current namespace if none is provided)
     * @returns a list of all resources of the given type in the given namespace
     */
    public async getKubernetesObjects(
        resourceType: string,
        namespace?: string,
    ): Promise<KubernetesObject[]> {
        const result = await CliChannel.getInstance().executeTool(
            Oc.getKubernetesObjectCommand(resourceType, namespace),
        );
        return JSON.parse(result.stdout).items;
    }

    public async getRouteURL(project: string): Promise<string> {
        try {
            const args = [new CommandOption('-o', 'json')];
            const commandText = new CommandText('oc', `get route ${project}`, args);
            const result = await CliChannel.getInstance().executeTool(
                commandText
            );
            return result.stdout.length > 0 ? JSON.parse(result.stdout).spec.host : undefined;
        } catch (err) {
            return undefined;
        }
    }

    /**
     * Returns the Kubernetes resource with the given name and type in the given namespace.
     *
     * If no namespace is supplied, the current namespace is used.
     *
     * @param resourceType the type of resource to get
     * @param resourceName the name of the resource to get
     * @param namespace the namespace to list the resources of (defaults to the current namespace if none is provided)
     * @returns the Kubernetes resource with the given name and type in the given namespace
     */
    public async getKubernetesObject(
        resourceType: string,
        resourceName: string,
        namespace?: string,
    ): Promise<KubernetesObject> {
        const result = await CliChannel.getInstance().executeTool(
            Oc.getSingleKubernetesObjectCommand(resourceType, resourceName, namespace),
        );
        return JSON.parse(result.stdout);
    }

    public async getAllKubernetesObjects(namespace?: string): Promise<KubernetesObject[]> {
        const result = await CliChannel.getInstance().executeTool(
            Oc.getKubernetesObjectCommand('all', namespace),
        );
        return JSON.parse(result.stdout).items;
    }

    /**
     * Delete the given Kubernetes resource
     *
     * @param resourceType the type of the Kubernetes resource to delete
     * @param resourceName the name of the Kubernetes resource to delete
     * @param namespace the namespace that the Kubernetes resource to delete is in. If not provided, the current namespace will be used
     */
    public async deleteKubernetesObject(
        resourceType: string,
        resourceName: string,
        namespace?: string,
    ) {
        await CliChannel.getInstance().executeTool(
            Oc.deleteKubernetesObjectCommand(resourceType, resourceName, namespace),
        );
    }

    /**
     * Create a Kubernetes object from the given spec.
     *
     * @param spec the spec of the kubernetes object to create
     */
    public async createKubernetesObjectFromSpec(spec: object) {
        const jsonString = JSON.stringify(spec);
        const tempJsonFile = await new Promise<string>((resolve, reject) => {
            tmp.file({ postfix: '.json' }, (err, name) => {
                if (err) {
                    reject(err);
                }
                resolve(name);
            });
        });
        try {
            await fs.writeFile(tempJsonFile, jsonString);
            // call oc create -f path/to/file until odo does support creating services without component
            await CliChannel.getInstance().executeTool(
                new CommandText('oc', 'create', [new CommandOption('-f', tempJsonFile)]),
            );
        } finally {
            await fs.unlink(tempJsonFile);
        }
    }

    /**
     * Create a Kubernetes object from the given file.
     *
     * @param file the file containing the spec of the kubernetes object to create
     */
    public async createKubernetesObjectFromFile(file: string) {
        await CliChannel.getInstance().executeTool(
            new CommandText('oc', 'create', [new CommandOption('-f', file)]),
        );
    }

    /**
     * Delete the Kubernetes object described by the given file.
     *
     * @param file the file containing the spec of the kubernetes object to delete
     */
    public async deleteKubernetesObjectFromFile(file: string): Promise<void> {
        await CliChannel.getInstance().executeTool(
            new CommandText('oc', 'delete', [new CommandOption('-f', file)])
        );
    }

    /**
     * Returns the token for the current user.
     *
     * @returns the token for the current user
     * @throws if no user is logged in
     */
    public async getCurrentUserToken(): Promise<string> {
        const result = await CliChannel.getInstance().executeTool(new CommandText('oc', 'whoami -t'));
        return result.stdout.trim();
    }

    /**
     * Returns true if the current user is authorized to create a pod in the current namespace on the cluster, and false otherwise.
     *
     * @returns true if the current user is authorized to create a pod in the current namespace on the cluster, and false otherwise
     */
    public async canCreatePod(): Promise<boolean> {
        try {
            const result = await CliChannel.getInstance().executeTool(
                new CommandText('oc', 'auth can-i create pod'),
            );
            if (result.stdout === 'yes') {
                return true;
            }
        } catch {
            //ignore
        }
        return false;
    }

    /**
     * Returns true if the current user is authorized to create a namespace on the cluster, and false otherwise.
     *
     * @returns true if the current user is authorized to create namespace on the cluster, and false otherwise
     */
    public async canCreateNamespace(): Promise<boolean> {
        try {
            const result = await CliChannel.getInstance().executeTool(
                new CommandText('oc', 'auth can-i create projectrequests'),
            );
            if (result.stdout === 'yes') {
                return true;
            }
        } catch {
            //ignore
        }
        return false;
    }

    /**
     * Returns true if the current user is authorized to list namespaces on the cluster, and false otherwise.
     *
     * @returns true if the current user is authorized to list namespaces on the cluster, and false otherwise
     */
    public async canListNamespaces(): Promise<boolean> {
        try {
            const result = await CliChannel.getInstance().executeTool(
                new CommandText('oc', 'auth can-i list projects'),
            );
            if (result.stdout === 'yes') {
                return true;
            }
        } catch {
            //ignore
        }
        return false;
    }

    /**
     * Returns true if the current user is authorized to delete a namespace on the cluster, and false otherwise.
     *
     * @param namespace the namespace to be deleted (defaults to the current namespace if none is provided)
     * @returns true if the current user is authorized to delete namespace on the cluster, and false otherwise
     */
    public async canDeleteNamespace(namespace?: string): Promise<boolean> {
        try {
            const args: CommandOption[] = [];
            if (namespace) {
                args.push(new CommandOption('--namespace', namespace));
            }
            const result = await CliChannel.getInstance().executeTool(
                new CommandText('oc', 'auth can-i delete projects', args)
            );
            if (result.stdout === 'yes') {
                return true;
            }
        } catch {
            //ignore
        }
        return false;
    }

    /**
     * Returns true if the current user is authorized to get a kubernates objects on the cluster, and false otherwise.
     *
     * @param resourceType the string containing the [TYPE | TYPE/NAME | NONRESOURCEURL] of the kubernetes object
     * @returns true if the current user is authorized to get a kubernates objects on the cluster, and false otherwise
     */
    public async canGetKubernetesObjects(resourceType: string): Promise<boolean> {
        try {
            const result = await CliChannel.getInstance().executeTool(
                new CommandText('oc', `auth can-i get ${resourceType}`),
            );
            if (result.stdout === 'yes' && result.stderr.indexOf('not namespace scoped') < 0) {
                return true;
            }
        } catch {
            //ignore
        }
        return false;
    }

    /**
     * Deletes all deployments in the current namespace that have a label "component" with a value `componentName`.
     *
     * @param componentName the value of the component label to match
     */
    public async deleteDeploymentByComponentLabel(componentName: string): Promise<void> {
        await CliChannel.getInstance().executeTool(new CommandText('oc', 'delete deployment', [
            new CommandOption('-l', `component='${componentName}'`),
        ]));
    }

    /**
     * Returns the url and type of the console for the current cluster.
     *
     * @returns the url and type of the console for the current cluster
     */
    public async getConsoleInfo(): Promise<KubernetesConsole> {
        try {
            // only works on OpenShift
            const getUrlObj = await CliChannel.getInstance().executeTool(
                new CommandText(
                    'oc', 'get configmaps console-public -n openshift-config-managed -o json',
                ),
            );
            const consoleUrl = JSON.parse(getUrlObj.stdout).data.consoleURL;
            return {
                kind: ClusterType.OpenShift,
                url: consoleUrl,
            };
        } catch (ignore) {
            const serverUrl = await CliChannel.getInstance().executeTool(
                new CommandText('oc', 'whoami --show-server'),
            );
            const consoleUrl = `${serverUrl.stdout}/console`;
            return {
                kind: ClusterType.Kubernetes,
                url: consoleUrl,
            }
        }
    }

    /**
     * Log into the given OpenShift cluster using the given username and password.
     *
     * @param clusterURL the URL of the cluster to log in to
     * @param username the username to use when logging in
     * @param password the password to use when logging in
     * @param abortController if provided, allows cancelling the operation
     */
    public async loginWithUsernamePassword(
        clusterURL: string,
        username: string,
        password: string,
        abortController?: AbortController
    ): Promise<void> {
        const options = abortController ? { signal: abortController.signal } : undefined;
        const result = await CliChannel.getInstance().executeTool(
            new CommandText('oc', `login ${clusterURL}`, [
                new CommandOption('-u', username, true, true),
                new CommandOption('-p', password, true, true),
                new CommandOption('--insecure-skip-tls-verify'),
            ]),
            options
        );
        if (result.stderr) {
            throw new Error(result.stderr);
        }
    }

    /**
     * Log into the given OpenShift cluster using the provided token.
     *
     * @param clusterURL the URL of the cluster to log in to
     * @param token the token to use to log in to the cluster
     * @param abortController if provided, allows cancelling the operation
     */
    public async loginWithToken(clusterURL: string, token: string,
            abortController?: AbortController): Promise<void> {
        const options = abortController ? { signal: abortController.signal } : undefined;
        const result = await CliChannel.getInstance().executeTool(
            new CommandText('oc', `login ${clusterURL}`, [
                new CommandOption('--token', token.trim()),
                new CommandOption('--insecure-skip-tls-verify'),
            ]),
            options
        );
        if (result.stderr) {
            throw new Error(result.stderr);
        }
    }

    /**
     * Switches the current Kubernetes context to the given named context.
     *
     * @param contextName the name of the context to switch to
     */
    public async setContext(contextName: string): Promise<void> {
        await CliChannel.getInstance().executeTool(
            new CommandText('oc', `config use-context ${contextName}`),
        );
    }

    /**
     * Clears (unsets) the current Kubernetes context.
     */
    public async unsetContext(): Promise<void> {
        await CliChannel.getInstance().executeTool(
            new CommandText('oc', 'config unset current-context'),
        );
    }

    /**
     * Deletes the given Kubernetes context from the kube config.
     *
     * @param contextName the name of the context to delete
     */
    public async deleteContext(contextName: string): Promise<void> {
        await CliChannel.getInstance().executeTool(
            new CommandText('oc', `config delete-context ${contextName}`),
        );
    }

    /**
     * Deletes the given user from the kube config.
     *
     * @param username the user to delete
     */
    public async deleteUser(username: string): Promise<void> {
        await CliChannel.getInstance().executeTool(new CommandText('oc', `config delete-user ${username}`));
    }

    /**
     * Deletes the given cluster from the kube config.
     *
     * @param cluster the name of the cluster to delete
     */
    public async deleteCluster(cluster: string): Promise<void> {
        await CliChannel.getInstance().executeTool(new CommandText('oc', `config delete-cluster ${cluster}`));
    }

    /**
     * Returns true if the current cluster is an OpenShift cluster, and false otherwise
     *
     * @returns true if the current cluster is an OpenShift cluster, and false otherwise
     */
    public async isOpenShiftCluster(): Promise<boolean> {
        const find = Platform.OS !== 'win32' ? 'grep' : 'FINDSTR';
        try {
            const result = await CliChannel.getInstance().executeTool(new CommandText(`oc api-resources | ${find} openshift`));
            if (result.stdout.length === 0) {
                return false;
            }
            return true;
        } catch (e) {
            // probably no
            return false;
        }
    }

    /**
     * Returns true if the current user can access CRDs and false otherwise.
     *
     * @returns true if the current user can access CRDs and false otherwise
     */
    public async canIGetCRDs(): Promise<boolean> {
        try {
            await CliChannel.getInstance().executeTool(
                new CommandText('oc', 'auth can-i get CustomResourceDefinition'),
            );
            return true;
        } catch (e) {
            // do nothing
        }
        return false;
    }

    /**
     * Creates a deployment with the given name from the given image URL.
     *
     * @param name the name of the deployment to create
     * @param imageUrl the url of the image to deploy
     */
    public async createDeploymentFromImage(name: string, imageUrl: string): Promise<void> {
        await CliChannel.getInstance().executeTool(
            new CommandText('oc', `create deployment ${name}`, [new CommandOption('--image', imageUrl)])
        );
    }

    /**
     * Scale replicas count
     *
     * @param name of the deployment
     * @param count
     * @returns the logs for the given resource
     */
    public async scalePod(name: string, count: string): Promise<string> {
        const result = await CliChannel.getInstance().executeTool(
            new CommandText('oc', `scale deployment ${name}`, [new CommandOption('--replicas', count)])
        );
        return result.stdout;
    }

    /**
     * Returns the logs for the given resource.
     *
     * @param resourceType the type of resource to get the logs for
     * @param name the name of the resource to get the logs for
     * @param namespace (optional) namespace where the logs are to be acquired
     * @throws if the logs are not available
     * @returns the logs for the given resource
     */
    public async getLogs(resourceType: string, name: string, namespace?: string): Promise<string> {
        const args: CommandOption[] = [];
        if (namespace) {
            args.push(new CommandOption('--namespace', namespace));
        }
        const result = await CliChannel.getInstance().executeTool(
            new CommandText('oc', `logs ${resourceType}/${name}`, args)
        );
        return result.stdout;
    }

    public async deleteProject(projectName: string): Promise<string> {
        const obj = await this.isOpenShiftCluster() ? 'project' : 'namespace';
        return await CliChannel.getInstance().executeTool(
                new CommandText('oc', `delete ${obj} ${projectName}`)
            )
            .then((result) => result.stdout);
    }

    public async createProject(projectName: string):  Promise<string> {
        const cmd = await this.isOpenShiftCluster() ? 'new-project' : 'create namespace';

        return await CliChannel.getInstance().executeTool(
                new CommandText('oc', `${cmd} ${projectName}`)
            )
            .then(async (result) => {
                // oc doesn't handle switching to the newly created namespace/project
                await this.setProject(projectName);
                return result.stdout;
            });
    }

    /**
     * Changes which project is currently being used.
     *
     * On non-OpenShift, namespaces are used instead of projects
     *
     * @param projectName the new project to use
     */
    public async setProject(projectName: string): Promise<void> {
        if(await this.isOpenShiftCluster()) {
            await CliChannel.getInstance().executeTool(
                new CommandText('oc', `project ${projectName}`),
            );
        } else {
            await CliChannel.getInstance().executeTool(
                new CommandText('oc', 'config set-context', [
                    new CommandOption('--current'),
                    new CommandOption('--namespace', projectName)
                ])
            );
        }
    }

    public async getProjects(onlyFromCluster: boolean = false): Promise<Project[]> {
        return this._listProjects()
            .then((projects) => onlyFromCluster ? projects : this.fixActiveProject(projects));
    }

    /**
     * Returns the active project or null if no project is active
     *
     * @returns the active project or null if no project is active
     */
    public async getActiveProject(): Promise<string> {
        return this._listProjects()
            .then((projects) => {
                const fixedProjects = this.fixActiveProject(projects);
                const activeProject = fixedProjects.find((project) => project.active);
                return activeProject ? activeProject.name : null;
            });
    }

    /**
     * Fixes the projects array by marking up an active project (if not set)
     * by the following rules:
     * - If there is only one single project - mark it as active
     * - If there is already at least one project marked as active - return the projects "as is"
     * - If Kube Config's current context has a namespace set - find an according project
     *   and mark it as active
     * - [fixup for Sandbox cluster] Get Kube Configs's curernt username and try finding a project,
     *   which name is partially created from that username - if found, treat it as an active project
     * - Try a 'default' as a project name, if found - use it as an active project name
     * - Use first project as active
     *
     * @returns The array of Projects with at least one project marked as an active
     */
    public fixActiveProject(projects: Project[]): Project[] {
        const kcu = new KubeConfigUtils();
        const currentContext = kcu.findContext(kcu.currentContext);

        let fixedProjects = projects.length ? projects : [];
        let activeProject = undefined;

        if (currentContext) {
            // Try Kube Config current context to find existing active project
            if (currentContext.namespace) {
                activeProject = fixedProjects.find((project) => project.name === currentContext.namespace);
                if (activeProject) {
                    activeProject.active = true;
                    return fixedProjects;
                }
            }

            // [fixup for Sandbox cluster] Get Kube Configs's curernt username and try finding a project,
            // which name is partially created from that username
            const currentUser = kcu.getCurrentUser();
            if (currentUser) {
                const projectPrefix = currentUser.name.substring(0, currentUser.name.indexOf('/'));
                if (projectPrefix.length > 0) {
                    activeProject = fixedProjects.find((project) => project.name.includes(projectPrefix));
                    if (activeProject) {
                        activeProject.active = true;
                        void Oc.Instance.setProject(activeProject.name);
                        return fixedProjects;
                    }
                }
            }

            // Add Kube Config current context to the proect list for cases where
            // projects/namespaces cannot be listed due to the cluster config restrictions
            // (such a project/namespace can be set active manually)
            if (currentContext.namespace) {
                fixedProjects = [
                    {
                        name: currentContext.namespace,
                        active: true
                    },
                    ...projects
                ]
                void Oc.Instance.setProject(currentContext.namespace);
                return fixedProjects;
            }
        }

        // Try a 'default' as a project name, if found - use it as an active project name
        activeProject = fixedProjects.find((project) => project.name === 'default');
        if (activeProject) {
            activeProject.active = true;
            return fixedProjects;
        }

        // Set the first available project as active
        if (fixedProjects.length > 0) {
            fixedProjects[0].active = true;
            void Oc.Instance.setProject(fixedProjects[0].name);
        }

        return fixedProjects;
    }

    private async _listProjects(): Promise<Project[]> {
        const namespaces: Project[] = [];
        return await CliChannel.getInstance().executeTool(
                new CommandText('oc', 'projects -q')
            )
            .then( (result) => {
                const lines = result.stdout && result.stdout.split(/\r?\n/g);
                for (let line of lines) {
                    line = line.trim();
                    if (line === '') continue;
                    namespaces.push( {name: line, active: false });
                }
                return namespaces;
            })
            .catch((error) => namespaces);
    }

    /**
     * Returns the oc command to list all resources of the given type in the given (or current) namespace
     *
     * @param resourceType the resource type to get
     * @param namespace the namespace from which to get all the stateful sets
     * @returns the oc command to list all resources of the given type in the given (or current) namespace
     */
    private static getKubernetesObjectCommand(
        resourceType: string,
        namespace?: string,
    ): CommandText {
        if (!resourceType) {
            throw new Error('Must pass the resource type to get');
        }
        const args = [new CommandOption('-o', 'json')];
        if (namespace) {
            args.push(new CommandOption('--namespace', namespace));
        }
        return new CommandText('oc',  `get ${resourceType}`, args);
    }

    private static getSingleKubernetesObjectCommand(
        resourceType: string,
        resourceName: string,
        namespace?: string,
    ): CommandText {
        if (!resourceType) {
            throw new Error('Must pass the resource type to get');
        }
        const args = [new CommandOption('-o', 'json')];
        if (namespace) {
            args.push(new CommandOption('--namespace', namespace));
        }
        return new CommandText('oc', `get ${resourceType} ${resourceName}`, args);
    }

    private static deleteKubernetesObjectCommand(
        resourceType: string,
        resourceName: string,
        namespace?: string,
    ): CommandText {
        if (!resourceType || !resourceName) {
            throw new Error('Must pass the resource type and resource name');
        }
        const args = [];
        if (namespace) {
            args.push(new CommandOption('--namespace', namespace));
        }
        return new CommandText('oc', `delete ${resourceType} ${resourceName}`, args);
    }
}
