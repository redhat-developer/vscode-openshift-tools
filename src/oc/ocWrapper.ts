/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubernetesObject } from '@kubernetes/client-node/dist/types';
import * as fs from 'fs/promises';
import * as tmp from 'tmp';
import { CommandOption, CommandText } from '../base/command';
import { CliChannel } from '../cli';
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

    /**
     * Returns the Kubernetes resource with the given name and type in the given namespace.
     *
     * If no namespace is supplied, the current namespace is used.
     *
     * @param resourceType the type of resource to get
     * @param resourceType the name of the resource to get
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
     * Returns the username of the current user.
     *
     * @returns the username of the current user
     */
    public async getCurrentUser(): Promise<string> {
        const result = await CliChannel.getInstance().executeTool(new CommandText('oc', 'whoami'));
        return result.stdout;
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
            if (result.stdout === 'yes') {
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
     */
    public async loginWithUsernamePassword(
        clusterURL: string,
        username: string,
        password: string,
    ): Promise<void> {
        const result = await CliChannel.getInstance().executeTool(
            new CommandText('oc', `login ${clusterURL}`, [
                new CommandOption('-u', username, true, true),
                new CommandOption('-p', password, true, true),
                new CommandOption('--insecure-skip-tls-verify'),
            ]),
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
     */
    public async loginWithToken(clusterURL: string, token: string): Promise<void> {
        const result = await CliChannel.getInstance().executeTool(
            new CommandText('oc', `login ${clusterURL}`, [
                new CommandOption('--token', token.trim()),
                new CommandOption('--insecure-skip-tls-verify'),
            ]),
        );
        if (result.stderr) {
            throw new Error(result.stderr);
        }
    }

    /**
     * Log out of the current OpenShift cluster.
     *
     * @throws if you are not currently logged into an OpenShift cluster
     */
    public async logout(): Promise<void> {
        await CliChannel.getInstance().executeTool(new CommandText('oc', 'logout'));
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
        try {
            const result = await CliChannel.getInstance().executeTool(new CommandText('oc api-resources | grep openshift'));
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
