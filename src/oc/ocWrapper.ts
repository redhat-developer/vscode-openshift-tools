/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Cluster, Context, User } from '@kubernetes/client-node';
import { KubernetesObject } from '@kubernetes/client-node/dist/types';
import * as fs from 'fs/promises';
import * as tmp from 'tmp';
import validator from 'validator';
import { CommandOption, CommandText } from '../base/command';
import { CliChannel, ExecutionContext } from '../cli';
import { CliExitData } from '../util/childProcessUtil';
import { isOpenShiftCluster, KubeConfigInfo, loadKubeConfig, serializeKubeConfig } from '../util/kubeUtils';
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
     * @param selector a selector string for the k8s object when needed
     * @returns a list of all resources of the given type in the given namespace
     */
    public async getKubernetesObjects(
        resourceType: string,
        namespace?: string,
        selector?: string,
        executionContext?: ExecutionContext
    ): Promise<KubernetesObject[]> {
        const result = await CliChannel.getInstance().executeTool(
            Oc.getKubernetesObjectCommand(resourceType, namespace, selector),
            undefined, true, executionContext);
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
        } catch {
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
        executionContext?: ExecutionContext
    ): Promise<KubernetesObject> {
        const result = await CliChannel.getInstance().executeTool(
            Oc.getSingleKubernetesObjectCommand(resourceType, resourceName, namespace),
            undefined, true, executionContext);
        return JSON.parse(result.stdout);
    }

    public async getAllKubernetesObjects(namespace?: string, executionContext?: ExecutionContext): Promise<KubernetesObject[]> {
        const result = await CliChannel.getInstance().executeTool(
            Oc.getKubernetesObjectCommand('all', namespace), undefined, true, executionContext);
        try {
            return JSON.parse(result.stdout).items;
        } catch {
            return [];
        }
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
    public async canGetKubernetesObjects(resourceType: string, executionContext: ExecutionContext): Promise<boolean> {
        try {
            const result = await CliChannel.getInstance().executeTool(
                new CommandText('oc', `auth can-i get ${resourceType}`),
                undefined, true, executionContext);
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
        } catch {
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
     * @param context the context to be altered, if specified
     * @param abortController if provided, allows cancelling the operation
     */
    public async loginWithUsernamePassword(clusterURL: string, username: string, password: string,
        context?: string, abortController?: AbortController): Promise<void> {
        const args: CommandOption[] = [
            new CommandOption('-u', username, true, true),
            new CommandOption('-p', password, true, true),
            new CommandOption('--insecure-skip-tls-verify')
        ];

        await this.wrapLogin(clusterURL, args, context, abortController);
    }

    /**
     * Log into the given OpenShift cluster using the provided token.
     *
     * @param clusterURL the URL of the cluster to log in to
     * @param token the token to use to log in to the cluster
     * @param context the context to be altered, if specified
     * @param abortController if provided, allows cancelling the operation
     */
    public async loginWithToken(clusterURL: string, token: string, context?: string, abortController?: AbortController): Promise<void> {
        const args: CommandOption[] = [
            new CommandOption('--token', token.trim()),
            new CommandOption('--insecure-skip-tls-verify')
        ];

        await this.wrapLogin(clusterURL, args, context, abortController);
    }

    /**
     * Executes 'oc login' using the given Cluster URL and the command options, altering the selected
     * Kube config, if provided, or creating a new one (created by 'oc')
     *
     * @param clusterURL the URL of the cluster to log in to
     * @param commandOptions A 'CommandOption` array for `oc login` command
     * @param selectedContext [optional] A context to alter with the result of login operation
     * @param abortController if provided, allows cancelling the operation
     * @returns A Kube context name used in or created after successfull login.
     */
    private async wrapLogin(clusterURL: string, commandOptions: CommandOption[], selectedContext?: string, abortController?: AbortController): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            tmp.file(async (err, path, fd, cleanupCallback) => {
                if (err) throw err;
                try {
                    const options = abortController ? { signal: abortController.signal } : undefined;

                    // Find `--kubeconfig` Command Option and replace its value with the path to temporary config file
                    const kcOptionIndex = commandOptions.findIndex((o) => o.name === '--kubeconfig');
                    if (kcOptionIndex !== -1) {
                        commandOptions.splice(kcOptionIndex, 1);
                    }
                    commandOptions.push(new CommandOption('--kubeconfig', path, true, true));

                    const result = await CliChannel.getInstance().executeTool(new CommandText('oc', `login ${clusterURL}`, commandOptions), options);
                    if (result.stderr) {
                        throw new Error(result.stderr);
                    }

                    // Get the context/cluster/user objects from the temporary config created by 'oc login'
                    const newConfig = loadKubeConfig(path);
                    let newContext: Context = newConfig?.contexts?.find((c) => c.name === newConfig.currentContext);
                    let newCluster: Cluster = newContext && newConfig?.clusters?.find((c) => c.name === newContext.cluster);
                    let newUser: User = newContext && newConfig?.users?.find((u) => u.name === newContext.user);
                    let newContextPath, newClusterPath, newUserPath;

                    // Default path for the Kube config changes
                    newContextPath = newClusterPath = newUserPath = KubeConfigInfo.getMainContextConfigPath();

                    if (selectedContext) {
                        // Get the context/cluster/user object mappings for the current context from the Kube config
                        const k8cConfigInfo = new KubeConfigInfo();
                        const [ selectedCtxPath, selectedCtx ] = [...k8cConfigInfo.getContextMap()].find(([key, values]) => values?.find((c) => c.name === selectedContext))
                            || [undefined, undefined];
                        if (selectedCtx && selectedCtx[0]) {
                            const [ selectedClusterPath, selectedCluster] = [...k8cConfigInfo.getClusterMap()].find(([key, values]) => values?.find((c) => c.name === selectedCtx[0].cluster))
                                || [undefined, undefined];

                            if (selectedCluster && selectedCluster[0]) {
                                newClusterPath = selectedClusterPath; // Change the path to save the cluster
                                newCluster = { ...newCluster, name: selectedCtx[0].cluster }; // Replace the only cluster name in newContext
                            } else {
                                newClusterPath = selectedCtxPath; // If it's a new cluster, save it to the same config as context
                            }

                            const [ selectedUserPath, selectedUser ] =  [...k8cConfigInfo.getUserMap()].find(([key, values]) => values?.find((u) => u.name === selectedCtx[0].user))
                                || [undefined, undefined];
                            if (selectedUser && selectedUser[0]) {
                                newUserPath = selectedUserPath; // Change the path to save the user
                                newUser = { ...newUser, name: selectedCtx[0].user }; // Replace the only user name in newContext
                            } else {
                                newUserPath = selectedCtxPath; // If it's a new user, save it to the same config as context
                            }

                            // Update context with the new properties, leaving the others as they are (f.i., namespace property)
                            newContextPath = selectedCtxPath; // Change the path to save the context
                            newContext = { ...newContext, name: selectedCtx[0].name, cluster: newCluster.name, user: newUser.name};
                        }
                    }

                    type ConfigChange = { context: Context, cluster: Cluster, user: User };

                    // Group the Config items by Config paths so we can minimize file operations
                    const configItemMap: Map<string, ConfigChange> = new Map<string, ConfigChange>();
                    let item: ConfigChange = configItemMap.get(newContextPath) ; // This is an excessive as we're sure the map is empty gere
                    configItemMap.set(newContextPath, { context: newContext, cluster: item?.cluster, user: item?.user });
                    item = configItemMap.get(newClusterPath);
                    configItemMap.set(newClusterPath, { context: item?.context, cluster: newCluster, user: item?.user });
                    item = configItemMap.get(newUserPath);
                    configItemMap.set(newUserPath, { context: item?.context, cluster: item?.cluster, user: newUser });

                    // Save the changes
                    for (const [key, value] of configItemMap.entries()) {
                        await this.mergeOrAddConfigData(key, value?.context, value?.cluster, value?.user);
                    }

                    // Fix up for a newly created context: if no selectedContext was provided,
                    // a new context might be created, so we have to switch current context to point
                    // to that new context
                    if (newContext.name !== selectedContext) {
                        await this.setContext(newContext.name);
                    }

                    resolve(selectedContext);
                } catch (_err) {
                    reject(_err);
                } finally {
                    cleanupCallback();
                }
            });
        });
    }

    private async mergeOrAddConfigData(configPath: string, context: Context, cluster: Cluster, user: User): Promise<void> {
        const kubeConfig =loadKubeConfig(configPath);

        // Merge or add Context
        const modifiedContexts: Context[] = kubeConfig.contexts;
        const contextIndex = modifiedContexts.findIndex((c) => c.name === context.name);
        if (contextIndex !== -1) { // Remove existing context
            modifiedContexts.splice(contextIndex, 1);
        }
        modifiedContexts.unshift(context);
        kubeConfig.contexts = modifiedContexts;

        // Merge or add Cluster
        const modifiedClusters: Cluster[] = kubeConfig.clusters;
        const clusterIndex = modifiedClusters.findIndex((c) => c.name === cluster.name);
        if (clusterIndex !== -1) { // Remove existing context
            modifiedClusters.splice(clusterIndex, 1);
        }
        modifiedClusters.unshift(cluster);
        kubeConfig.clusters = modifiedClusters;

        // Merge or add User
        const modifiedUsers: User[] = kubeConfig.users;
        const userIndex = modifiedUsers.findIndex((c) => c.name === user.name);
        if (userIndex !== -1) { // Remove existing context
            modifiedUsers.splice(userIndex, 1);
        }
        modifiedUsers.unshift(user);
        kubeConfig.users = modifiedUsers;

        await fs.writeFile(configPath, serializeKubeConfig(kubeConfig), 'utf8');
    }

    /**
     * Switches the current Kubernetes context to the given named context.
     * If multiple Kube configs are defined in '$KUBECONFIG' env. variable,
     * the first 'current-context' instance will be set to the specified context name, while
     * all the other instances will be cleared, to prevent 'random' context switching at
     * logging off the current cluster.
     *
     * @param contextName the name of the context to switch to
     */
    public async setContext(contextName: string): Promise<void> {
        // Clear the current Context in all the configs
        await this.unsetContext();

        // Set Context in the main config (default or the first in '$KUBECONFIG' env. variable)
        await CliChannel.getInstance().executeTool(
            new CommandText('oc', `config use-context ${contextName}`)
        );
    }

    /**
     * Clears (unsets) the current Kubernetes context.
     */
    public async unsetContext(): Promise<void> {
        const allConfigPaths = KubeConfigInfo.getAllConfigPaths();
        // Clear the current Context in all the configs but the main one
        for (let i = 0; i < allConfigPaths.length; i++) {
            const path = allConfigPaths[i];
            if (path && path.trim().length > 0) {
                await CliChannel.getInstance().executeTool(
                    new CommandText('oc', 'config unset current-context',
                        [ new CommandOption('--kubeconfig', path.trim(), true, true) ]));
            }
        }
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
        } catch {
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

    public async createDeploymentFromGit(name: string, image: string, gitURL: string): Promise<CliExitData> {
        const args: CommandOption[] = [];
        if (name && !validator.isEmpty(name)) {
            args.push(new CommandOption('--name', name));
        }
        const result = await CliChannel.getInstance().executeTool(
            new CommandText('oc', `new-app ${image}~${gitURL}`, args), undefined, false
        )
        return result;
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

    public async deleteProject(projectName: string, executionContext?: ExecutionContext): Promise<string> {
        const obj = await isOpenShiftCluster(executionContext) ? 'project' : 'namespace';
        return await CliChannel.getInstance().executeTool(
            new CommandText('oc', `delete ${obj} ${projectName}`)
        )
            .then((result) => result.stdout);
    }

    public async createProject(projectName: string, executionContext?: ExecutionContext): Promise<string> {
        const cmd = await isOpenShiftCluster(executionContext) ? 'new-project' : 'create namespace';

        return await CliChannel.getInstance().executeTool(
            new CommandText('oc', `${cmd} ${projectName}`)
        )
            .then(async (result) => {
                // oc doesn't handle switching to the newly created namespace/project
                await this.setProject(projectName, executionContext);
                return result.stdout;
            });
    }

    public async createRoute(routeName: string, serviceName: string, hostName: string, path: string, port: { number: string, name: string, protocol: string, targetPort: string },
        isSecured: boolean): Promise<string> {
        let cmdText: CommandText;
        if (isSecured) {

            cmdText = new CommandText('oc', `create route edge ${routeName}`, [
                new CommandOption('--service', serviceName),
                new CommandOption('--port', port.number),
            ]);

        } else {
            cmdText = new CommandText('oc', `expose service ${serviceName.trim()}`, [
                new CommandOption('--name', routeName),
                new CommandOption('--port', port.number),
                new CommandOption('--target-port', port.targetPort),
                new CommandOption('--protocol', port.protocol)
            ]);
        }

        if (!validator.isEmpty(hostName)) {
            cmdText.addOption(new CommandOption('--hostname', hostName));
        }

        if (!validator.isEmpty(path)) {
            cmdText.addOption(new CommandOption('--path', path));
        }
        return await CliChannel.getInstance().executeTool(
            cmdText
        )
            .then((result) => result.stdout);
    }

    /**
     * Changes which project is currently being used.
     *
     * On non-OpenShift, namespaces are used instead of projects
     *
     * @param projectName the new project to use
     */
    public async setProject(projectName: string, executionContext?: ExecutionContext): Promise<void> {
        if (await isOpenShiftCluster(executionContext)) {
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

    public async getProjects(onlyFromCluster: boolean = false, executionContext?: ExecutionContext): Promise<Project[]> {
        return this._listProjects(executionContext)
            .then((projects) => onlyFromCluster ? projects : this.fixActiveProject(projects, executionContext));
    }

    /**
     * Returns the active project or null if no project is active
     *
     * @returns the active project or null if no project is active
     */
    public async getActiveProject(executionContext?: ExecutionContext): Promise<string> {
        return this._listProjects(executionContext)
            .then((projects) => {
                const fixedProjects = this.fixActiveProject(projects, executionContext);
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
    public fixActiveProject(projects: Project[], executionContext?: ExecutionContext): Project[] {
        const k8sConfigInfo = new KubeConfigInfo();
        const k8sConfig = k8sConfigInfo.getEffectiveKubeConfig();
        const currentContext = k8sConfigInfo.findContext(k8sConfig.currentContext);

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
            const currentUser = k8sConfig.getCurrentUser();
            if (currentUser) {
                const projectPrefix = currentUser.name.substring(0, currentUser.name.indexOf('/'));
                const matches = projectPrefix.match(/^system:serviceaccount:([a-zA-Z-_.]+-dev):pipeline$/);
                const projectName = matches ? matches[1] : projectPrefix;
                if (projectName.length > 0) {
                    activeProject = fixedProjects.find((project) => project.name.includes(projectName));
                    if (activeProject) {
                        activeProject.active = true;
                        void Oc.Instance.setProject(activeProject.name, executionContext);
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
                void Oc.Instance.setProject(currentContext.namespace, executionContext);
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
            void Oc.Instance.setProject(fixedProjects[0].name, executionContext);
        }

        return fixedProjects;
    }

    private async _listProjects(executionContext: ExecutionContext): Promise<Project[]> {
        const namespaces: Project[] = [];
        return await CliChannel.getInstance().executeTool(
            new CommandText('oc', 'projects -q'), undefined, true, executionContext
        )
            .then((result) => {
                const lines = result.stdout && result.stdout.split(/\r?\n/g);
                for (let line of lines) {
                    line = line.trim();
                    if (line === '') continue;
                    namespaces.push({ name: line, active: false });
                }
                return namespaces;
            })
            .catch((error) => namespaces);
    }

    public async hasImageInfo(url: string): Promise<boolean> {
        const imageURL = url.lastIndexOf(':') < 0 ? `${url}:latest` : url;
        const result = await CliChannel.getInstance().executeTool(
            new CommandText('oc', `image info ${imageURL} --show-multiarch=true`), undefined, false
        );
        return result.error && result.stderr.length > 0 ? false : true;
    }

    /**
     * Returns the oc command to list all resources of the given type in the given (or current) namespace
     *
     * @param resourceType the resource type to get
     * @param namespace the namespace from which to get all the stateful sets
     * @param selector a selector string for the k8s object when needed
     * @returns the oc command to list all resources of the given type in the given (or current) namespace
     */
    private static getKubernetesObjectCommand(
        resourceType: string,
        namespace?: string,
        selector?: string
    ): CommandText {
        if (!resourceType) {
            throw new Error('Must pass the resource type to get');
        }
        const args = [new CommandOption('-o', 'json')];
        if (namespace) {
            args.push(new CommandOption('--namespace', namespace));
        }
        if (selector) {
            args.push(new CommandOption('-l', `${selector}`));
        }
        return new CommandText('oc', `get ${resourceType}`, args);
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

    public static async getK8sOpenAPI(executionContext?: ExecutionContext): Promise<string> {
        // oc get --raw /openapi/v2
        const result = await CliChannel.getInstance().executeTool(
            new CommandText('oc', 'get --raw /openapi/v2'), undefined, true, executionContext);
        return result.stdout;
    }

    public async applyConfiguration(config: string): Promise<string> {
        // kubectl apply --server-side=true -f -
        const result = await CliChannel.getInstance().executeToolWithText(
            new CommandText('oc', 'apply -f -',
                [ new CommandOption('--server-side', 'true', false, false) ]),
            undefined, true, config);
        return result.stdout;
    }
}
