import { QuickPickItem } from "vscode";
import { KubeConfig } from '@kubernetes/client-node';
import { User, Cluster } from "@kubernetes/client-node/dist/config_types";

export async function getClusters(): Promise<QuickPickItem[]> {
    const kubectlConfig = new KubeConfig();
    kubectlConfig.loadFromDefault();
    const currentCluster = kubectlConfig.getCurrentCluster();
    const clusters = kubectlConfig.clusters || [];
    return clusters.map((c) => ({
            label: c.server,
            description: currentCluster && c.name === currentCluster.name ? 'Current Context' : ''
        })
    );
}

export async function getUsers(clusterServer: string): Promise<QuickPickItem[]> {
    const kubectlConfig = new KubeConfig();
    kubectlConfig.loadFromDefault();
    const currentUser = kubectlConfig.getCurrentUser();
    const cluster = findCluster(kubectlConfig, clusterServer);
    return kubectlConfig.getUsers().filter((item) => cluster && item.name.indexOf(cluster.name) > -1).map((u) => newUserQuickPickItem(u, currentUser));
}

function newUserQuickPickItem(u: User, ccu: User): QuickPickItem {
    const username = u.name.split('/')[0];
    return {
        label: username,
        description: u === ccu ? 'Current Context' : ''
    };
}

function findCluster(config: KubeConfig, clusterServer: string): Cluster {
    return config.getClusters().find((cluster: Cluster) => cluster.server === clusterServer);
}