import { QuickPickItem } from "vscode";
import { KubeConfig } from '@kubernetes/client-node';

export async function getClusters(): Promise<QuickPickItem[]> {
    const kubectlConfig = new KubeConfig();
    kubectlConfig.loadFromDefault();
    const currentContextServer = kubectlConfig.currentContext.split('/')[1];
    const clusters = kubectlConfig.clusters || [];
    return clusters.map((c) => {
        return {
            label: c.name,
            description: c.name === currentContextServer ? 'Current Context' : ''
        };
    });
}

export async function getUsers(clusterUrl: string): Promise<QuickPickItem[]> {
    const kubectlConfig = new KubeConfig();
    kubectlConfig.loadFromDefault();
    const currentContextUser = kubectlConfig.currentContext.split('/')[2];
    return kubectlConfig.getUsers()
            .filter((item) => {
                return item.name.split('/')[1] === clusterUrl;
            })
            .map((u) => {
                const username = u.name.split('/')[0];
                return {
                    label: username,
                    description: username === currentContextUser ? 'Current Context' : ''
            };
        });
}