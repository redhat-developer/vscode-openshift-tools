/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubeConfig, findHomeDir, loadYaml } from '@kubernetes/client-node';
import { Cluster, Context, User } from '@kubernetes/client-node/dist/config_types';
import * as fs from 'fs';
import * as path from 'path';
import { QuickPickItem, window } from 'vscode';
import { CommandText } from '../base/command';
import { CliChannel, ExecutionContext } from '../cli';
import { Platform } from './platform';

function fileExists(file: string): boolean {
    try {
        fs.accessSync(file);
        return true;
    } catch ( _ ) {
        return false;
    }
}

export class KubeConfigUtils extends KubeConfig {

    public readonly loadingError: any;
    constructor() {
        super();
        try {
            this.loadFromDefault();
        } catch (error) {
            throw new Error('Kubernetes configuration cannot be loaded. Please check configuration files for errors and fix them to continue.');
        }
        // k8s nodejs-client ignores all unknown properties,
        // so cluster object's proxy-url attribute is not present
        // after k8s config loaded
    }

    findHomeDir() {
        return findHomeDir();
    }

    getProxy(contextName: string): string | undefined {
        if (process.env.KUBECONFIG?.[1]) {
            const cFiles = process.env.KUBECONFIG.split(path.delimiter).filter(file => file);
            //const yaml =
            for (let i=0; i < cFiles.length; i++) {
                const proxyUrl = this.getClusterProxyFromFile(cFiles[i], contextName);
                if (proxyUrl) return proxyUrl;
            }
            return;
        }
        const home = this.findHomeDir();
        if (home) {
            const config = path.join(home, '.kube', 'config');
            if (fileExists(config)) {
                return this.getClusterProxyFromFile(config, contextName);
            }
        }
    }

    getClusterProxyFromFile(file: string, contextName: string): string {
        const fileContent = fs.readFileSync(file, 'utf8');
        const yaml: any = loadYaml(fileContent);
        const contextObj = yaml.contexts.find(
            (context) => context.name === contextName);
        const clusterObj = yaml.clusters.find(
            (cluster) => cluster.name === contextObj?.context?.cluster);
        return clusterObj?.cluster?.['proxy-url'];
    }

    public getServers(): QuickPickItem[] {
        const currentCluster = this.getCurrentCluster();
        const clusters = this.clusters || [];
        const qpItems = clusters.map((c: Cluster) => ({
            label: c.server,
            description: currentCluster && c.name === currentCluster.name ? 'Current Context' : '',
        }));
        const filterMap = new Set();
        return qpItems.filter((item) => {
            const notDuplicate = !filterMap.has(item.label);
            if(notDuplicate)  {
               filterMap.add(item.label);
            }
            return notDuplicate;
        });
    }

    public getClusterUsers(clusterServer: string): QuickPickItem[] {
        const currentUser = this.getCurrentUser();
        const cluster = this.findCluster(clusterServer);
        const users = this.getUsers();
        const clusterUsers = users.filter((item) => cluster && item.name.includes(cluster.name));
        return clusterUsers.map((u: User) => {
            const userName = u.name.split('/')[0];
            return {
                label: userName === 'kube:admin' ? 'kubeadmin' : userName,
                description: u === currentUser ? 'Current Context' : '',
            };
        });
    }

    public findCluster(clusterServer: string): Cluster {
        return this.getClusters().find((cluster: Cluster) => cluster.server === clusterServer);
    }

    public findClusterURL(clusterNameOrURL: string): string {
        let clusterObj: Cluster = this.findCluster(clusterNameOrURL);
        clusterObj = clusterObj || this.clusters.find((cluster: Cluster) => cluster.name === clusterNameOrURL);
        return clusterObj ? clusterObj.server : undefined;
    }

    public findContext(contextName: string): Context {
        return this.getContexts().find((context: Context) => context.name === contextName);
    }

    public findContextForCluster(clusterName: string): Context {
        return this.getContexts().find((context: Context) => context.cluster === clusterName);
    }

    public extractProjectNameFromCurrentContext():string {
        const currentContextName = this.getCurrentContext();
        return this.extractProjectNameFromContextName(currentContextName);
    }

    public extractProjectNameFromContextName(contextName: string):string {
        if (contextName && contextName.includes('/') && !contextName.startsWith('/')) {
            return contextName.split('/')[0];
        }
        return undefined;
    }

    public equalsToCurrentContext(contextName:string, cluster: string, namespace: string, user: string): boolean {
        const currentContext = this.findContext(this.currentContext);
        if (!currentContext) return false;

        if (currentContext.name !== contextName) return false;
        if (currentContext.cluster !== cluster) return false;
        if (currentContext.namespace !== namespace) return false;
        if (currentContext.user !== user) return false;
        return true;
    }
}

/**
 * Returns the list of kube config files:
 * - If KUBECONFIG is not set, just ~/.kube/config
 * - If KUBECONFIG is set, follows the semantics for specifying multiple config files described here:
 *   https://kubernetes.io/docs/tasks/access-application-cluster/configure-access-multiple-clusters/#append-home-kube-config-to-your-kubeconfig-environment-variable
 *   BUT: it shows an error if multiple configs are specified, since the Kubernetes client we are using doesn't support this use case.
 *
 * @returns the list of kube config files
 */
export function getKubeConfigFiles(): string[] {
    if (process.env.KUBECONFIG) {
        const configuredFiles: string[] = process.env.KUBECONFIG.split(path.delimiter);
        const filesThatExist: string[] = [];
        for (const configFile of configuredFiles) {
            if (fs.existsSync(configFile)) {
                filesThatExist.push(configFile);
            }
        }
        return filesThatExist;
    }
    return [path.join(Platform.getUserHomePath(), '.kube', 'config')];
}

/**
 * If there are multiple kube config files set, force the user to pick one to use.
 */
export async function setKubeConfig(): Promise<void> {
    const kubeConfigFiles = getKubeConfigFiles();
    if (kubeConfigFiles.length > 1) {
        let selectedFile;
        while(!selectedFile) {
            try {
                const potentialSelection = await window.showQuickPick(kubeConfigFiles, { canPickMany: false, placeHolder: 'VSCode OpenShift only supports using one kube config. Please select which one to use.' });
                if (potentialSelection) {
                    selectedFile = potentialSelection;
                }
            } catch (_) {
                // do nothing
            }
        }
        process.env.KUBECONFIG = selectedFile;
    }
}

export async function isOpenShiftCluster(executionContext?: ExecutionContext): Promise<boolean> {
    try {
        const stdout = await CliChannel.getInstance().executeSyncTool(new CommandText('oc', 'api-versions'), { timeout: 5000 }, executionContext);
        return stdout.includes('apps.openshift.io/v1');
    } catch(error) {
        return false;
    }
  }

export async function getNamespaceKind(executionContext?: ExecutionContext): Promise<string> {
    if (executionContext && executionContext.has(getNamespaceKind.name)) {
        return executionContext.get(getNamespaceKind.name);
    }
    const result: string = (await isOpenShiftCluster(executionContext)) ? 'Project' : 'Namespace';
    if (executionContext) {
        executionContext.set(getNamespaceKind.name, result);
    }
    return result;
}
