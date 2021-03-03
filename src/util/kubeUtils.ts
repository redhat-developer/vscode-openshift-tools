/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { QuickPickItem } from 'vscode';
import { KubeConfig } from '@kubernetes/client-node';
import { User, Cluster } from '@kubernetes/client-node/dist/config_types';

export class KubeConfigUtils extends KubeConfig {
    constructor() {
        super();
        this.loadFromDefault();
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
