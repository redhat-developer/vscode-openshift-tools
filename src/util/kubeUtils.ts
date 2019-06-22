import { QuickPickItem, window } from "vscode";
import * as k8s from 'vscode-kubernetes-tools-api';

interface Kubeconfig {
    readonly apiVersion: string;
    readonly 'current-context': string;
    readonly clusters: {
        readonly name: string;
        readonly cluster: {
            readonly server: string;
            readonly 'certificate-authority'?: string;
            readonly 'certificate-authority-data'?: string;
        };
    }[] | undefined;
    readonly contexts: {
        readonly name: string;
        readonly context: {
            readonly cluster: string;
            readonly user: string;
            readonly namespace?: string;
        };
    }[] | undefined;
    readonly users: {
        readonly name: string;
        readonly user: {};
    }[] | undefined;
}

async function getKubeconfig(): Promise<Kubeconfig | null> {
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        window.showWarningMessage(`Failed to fetch '~/.kube/config' file.`);
        return null;
    }
    if (kubectl.available) {
        const command = await kubectl.api.invokeCommand(`config view -o json`);
        return JSON.parse(command.stdout);
    }
}

export async function getClusters(): Promise<QuickPickItem[]> {
    const kubectlConfig = await getKubeconfig();
    if (!kubectlConfig) {
        return [];
    }
    const currentContextServer = kubectlConfig["current-context"].split('/')[1];
    const clusters = kubectlConfig.clusters || [];
    return clusters.map((c) => {
        return {
            label: c.name,
            description: c.name === currentContextServer ? 'Current Context' : ''
        };
    });
}

export async function getUsers(clusterUrl: string): Promise<QuickPickItem[]> {
    const kubectlConfig = await getKubeconfig();
    if (!kubectlConfig) {
        return [];
    }
    const currentContextUser = kubectlConfig["current-context"].split('/')[2];
    return kubectlConfig.users
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