/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { commands, Disposable, Uri, window } from 'vscode';
import { CliChannel } from '../cli';
import { Oc } from '../oc/ocWrapper';
import { ClusterType } from '../oc/types';
import { KubeConfigInfo } from '../util/kubeUtils';
import { vsCommand } from '../vscommand';

export class Console implements Disposable {
    private static instance: Console;

    public static getInstance(): Console {
        if (!Console.instance) {
            Console.instance = new Console();
        }
        return Console.instance;
    }

    dispose() { }

    static cli = CliChannel.getInstance()
    static getCurrentProject(): string {
        const k8sConfigInfo = new KubeConfigInfo();
        const k8sConfig = k8sConfigInfo.getEffectiveKubeConfig();
        if (k8sConfig.currentContext === undefined) {
            return undefined;
        }
        return k8sConfig.contexts?.find((ctx) => ctx.name === k8sConfig.currentContext).namespace;
    }

    @vsCommand('clusters.openshift.build.openConsole')
    static async openBuildConfig(context: { name: string}): Promise<void> {
        if (!context) {
            void window.showErrorMessage('Cannot load the build config');
            return;
        }
        const consoleInfo = await Oc.Instance.getConsoleInfo();
        const project = Console.getCurrentProject();

        let url: string = undefined;
        switch (consoleInfo.kind) {
            case ClusterType.Kubernetes: {
                url = `${consoleInfo.url}/project/${project}/browse/builds/${context.name}?tab=history`;
                break;
            }
            case ClusterType.OpenShift: {
                url = `${consoleInfo.url}/k8s/ns/${project}/buildconfigs/${context.name}`;
                break;
            }
            default:
                throw new Error('Should be impossible, since the cluster must be either OpenShift or non-OpenShift');
        }
        await commands.executeCommand('vscode.open', Uri.parse(url));
    }

    @vsCommand('clusters.openshift.deployment.openConsole')
    static async openDeploymentConfig(context: { name: string}): Promise<void> {
        if (!context) {
            void window.showErrorMessage('Cannot load the deployment config');
            return;
        }
        const project = Console.getCurrentProject();
        const consoleInfo = await Oc.Instance.getConsoleInfo();
        let url = '';
        switch (consoleInfo.kind) {
            case ClusterType.Kubernetes: {
                url = `${consoleInfo.url}/project/${project}/browse/dc/${context.name}?tab=history`;
                break;
            }
            case ClusterType.OpenShift: {
                url = `${consoleInfo.url}/k8s/ns/${project}/deploymentconfigs/${context.name}`;
                break;
            }
            default:
                throw new Error('Should be impossible, since the cluster must be either OpenShift or non-OpenShift');
        }
        await commands.executeCommand('vscode.open', Uri.parse(url));
    }

    @vsCommand('clusters.openshift.imagestream.openConsole')
    static async openImageStream(context: { name: string}): Promise<void> {
        if (!context) {
            void window.showErrorMessage('Cannot load the image stream');
            return;
        }
        const project = Console.getCurrentProject();
        const consoleInfo = await Oc.Instance.getConsoleInfo();
        let url = '';
        switch (consoleInfo.kind) {
            case ClusterType.Kubernetes: {
                url = `${consoleInfo.url}/project/${project}/browse/images/${context.name}`;
                break;
            }
            case ClusterType.OpenShift: {
                url = `${consoleInfo.url}/k8s/ns/${project}/imagestreams/${context.name}`;
                break;
            }
            default:
                throw new Error('Should be impossible, since the cluster must be either OpenShift or non-OpenShift');
        }
        await commands.executeCommand('vscode.open', Uri.parse(url));
    }

    @vsCommand('clusters.openshift.project.openConsole')
    static async openProject(context: { name: string}): Promise<void> {
        if (!context) {
            void window.showErrorMessage('Cannot load the Project');
            return;
        }
        const project = Console.getCurrentProject();
        const consoleInfo = await Oc.Instance.getConsoleInfo();
        let url = '';
        switch (consoleInfo.kind) {
            case ClusterType.Kubernetes: {
                url = `${consoleInfo.url}/project/${project}/overview`;
                break;
            }
            case ClusterType.OpenShift: {
                url = `${consoleInfo.url}/k8s/cluster/projects/${project}`;
                break;
            }
            default:
                throw new Error('Should be impossible, since the cluster must be either OpenShift or non-OpenShift');
        }
        await commands.executeCommand('vscode.open', Uri.parse(url));
    }
}
