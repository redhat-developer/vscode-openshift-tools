/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Command } from '../odo/command';
import { KubeConfigUtils } from '../util/kubeUtils';
import OpenShiftItem from '../openshift/openshiftItem';
import { vsCommand } from '../vscommand';

export class Console extends OpenShiftItem {

    static getCurrentProject(): string {
        const k8sConfig = new KubeConfigUtils();
        const project = (k8sConfig.contexts).find((ctx) => ctx.name === k8sConfig.currentContext).namespace;
        return project;
    }

    static async fetchOpenshiftConsoleUrl(): Promise<any> {
        try {
            return await Console.odo.execute(Command.showConsoleUrl());
        } catch (ignore) {
            const consoleUrl = await Console.odo.execute(Command.showServerUrl());
            return consoleUrl.stdout;
        }
    }

    static openShift4ClusterUrl(consoleUrl: any): string {
        return JSON.parse(consoleUrl.stdout).data.consoleURL;
    }

    @vsCommand('clusters.openshift.build.openConsole')
    static async openBuildConfig(context: { name: string}): Promise<unknown> {
        let url = '';
        if (!context) {
            vscode.window.showErrorMessage('Cannot load the build config');
            return;
        }
        const consoleUrl = await Console.fetchOpenshiftConsoleUrl();
        const project = Console.getCurrentProject();
        if (consoleUrl.stdout) {
            url = `${Console.openShift4ClusterUrl(consoleUrl)}/k8s/ns/${project}/buildconfigs/${context.name}`;
        } else {
            url = `${consoleUrl}/console/project/${project}/browse/builds/${context.name}?tab=history`;
        }
        return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }

    @vsCommand('clusters.openshift.deployment.openConsole')
    static async openDeploymentConfig(context: { name: string}): Promise<unknown> {
        let url = '';
        if (!context) {
            vscode.window.showErrorMessage('Cannot load the deployment config');
            return;
        }
        const project = Console.getCurrentProject();
        const consoleUrl = await Console.fetchOpenshiftConsoleUrl();
        if (consoleUrl.stdout) {
            url = `${Console.openShift4ClusterUrl(consoleUrl)}/k8s/ns/${project}/deploymentconfigs/${context.name}`;
        } else {
            url = `${consoleUrl}/console/project/${project}/browse/dc/${context.name}?tab=history`;
        }
        return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }

    @vsCommand('clusters.openshift.imagestream.openConsole')
    static async openImageStream(context: { name: string}): Promise<unknown> {
        let url = '';
        if (!context) {
            vscode.window.showErrorMessage('Cannot load the image stream');
            return;
        }
        const project = Console.getCurrentProject();
        const consoleUrl = await Console.fetchOpenshiftConsoleUrl();
        if (consoleUrl.stdout) {
            url = `${Console.openShift4ClusterUrl(consoleUrl)}/k8s/ns/${project}/imagestreams/${context.name}`;
        } else {
            url = `${consoleUrl}/console/project/${project}/browse/images/${context.name}`;
        }
        return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }

    @vsCommand('clusters.openshift.project.openConsole')
    static async openProject(context: { name: string}): Promise<unknown> {
        let url = '';
        if (!context) {
            vscode.window.showErrorMessage('Cannot load the Project');
            return;
        }
        const project = Console.getCurrentProject();
        const consoleUrl = await Console.fetchOpenshiftConsoleUrl();
        if (consoleUrl.stdout) {
            url = `${Console.openShift4ClusterUrl(consoleUrl)}/k8s/cluster/projects/${project}`;
        } else {
            url = `${consoleUrl}/console/project/${project}/overview`;
        }
        return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }
}
