/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import { QuickPickItem } from 'vscode';
import { KubeConfig, findHomeDir, loadYaml } from '@kubernetes/client-node';
import { User, Cluster } from '@kubernetes/client-node/dist/config_types';
import { Odo, OdoImpl } from '../odo';
import { VsCommandError } from '../vscommand';

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

    protected static getOdoInstance(): Odo {
        return OdoImpl.Instance;
    }

    async deleteCluster(cluster: Cluster) {
        try {
            await KubeConfigUtils.getOdoInstance().deleteCluster(cluster);
        } catch (error) {
            throw new VsCommandError(`Unable to delete the cluster '${cluster.server}'`, 'Failed to delete cluster');
        }
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

}
