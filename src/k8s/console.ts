/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Command } from "../odo";
import { KubeConfigUtils } from "../util/kubeUtils";
import { OpenShiftItem } from '../openshift/openshiftItem';
import { CliExitData } from '../cli';

const k8sConfig = new KubeConfigUtils();
const project = (k8sConfig.contexts).find((ctx) => ctx.name === k8sConfig.currentContext).namespace;

export class Console extends OpenShiftItem {

    static async fetchOpenshiftConsoleUrl() {
        try {
            return await Console.odo.execute(Command.showConsoleUrl());
        } catch (ignore) {
            const consoleUrl = await Console.odo.execute(Command.showServerUrl());
            return consoleUrl.stdout;
        }
    }

    static openShift4ClusterUrl(consoleUrl: string | CliExitData): string {
        return JSON.parse(consoleUrl['stdout']).data.consoleURL;
    }

    static async openBuildConfig(context: { name: any; }) {
        let url = '';
        if (!context) {
            vscode.window.showErrorMessage("Cannot load the build config");
            return;
        }
        const consoleUrl = await Console.fetchOpenshiftConsoleUrl();
        if (consoleUrl['stdout']) {
            url = `${Console.openShift4ClusterUrl(consoleUrl)}/k8s/ns/${project}/buildconfigs/${context.name}`;
        } else {
            url = `${consoleUrl}/console/project/${project}/browse/builds/${context.name}?tab=history`;
        }
        return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }

    static async openDeploymentConfig(context: { name: any; }) {
        let url = '';
        if (!context) {
            vscode.window.showErrorMessage("Cannot load the deployment config");
            return;
        }
        const consoleUrl = await Console.fetchOpenshiftConsoleUrl();
        if (consoleUrl['stdout']) {
            url = `${Console.openShift4ClusterUrl(consoleUrl)}/k8s/ns/${project}/deploymentconfigs/${context.name}`;
        } else {
            url = `${consoleUrl}/console/project/${project}/browse/dc/${context.name}?tab=history`;
        }
        return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }

    static async openImageStream(context: { name: any; }) {
        let url = '';
        if (!context) {
            vscode.window.showErrorMessage("Cannot load the image stream");
            return;
        }
        const consoleUrl = await Console.fetchOpenshiftConsoleUrl();
        if (consoleUrl['stdout']) {
            url = `${Console.openShift4ClusterUrl(consoleUrl)}/k8s/ns/${project}/imagestreams/${context.name}`;
        } else {
            url = `${consoleUrl}/console/project/${project}/browse/images/${context.name}`;
        }
        return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }

    static async openProject(context: { name: any; }) {
        let url = '';
        if (!context) {
            vscode.window.showErrorMessage("Cannot load the Project");
            return;
        }
        const consoleUrl = await Console.fetchOpenshiftConsoleUrl();
        if (consoleUrl['stdout']) {
            url = `${Console.openShift4ClusterUrl(consoleUrl)}/k8s/cluster/projects/${project}`;
        } else {
            url = `${consoleUrl}/console/project/${project}/overview`;
        }
        return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }
}