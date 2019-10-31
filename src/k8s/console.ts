/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Command } from "../odo";
import { KubeConfigUtils } from "../util/kubeUtils";
import { OpenShiftItem } from '../openshift/openshiftItem';

const k8sConfig = new KubeConfigUtils();
const clusterUrl = k8sConfig.getCurrentCluster().server;
const project = (k8sConfig.contexts).find((ctx) => ctx.name === k8sConfig.currentContext).namespace;

export class Console extends OpenShiftItem {

    static async fetchClusterVersion() {
        const versionInfo = await Console.odo.execute(Command.getclusterVersion(), process.cwd(), false);
        return versionInfo.error;
    }

    static async fetchOpenshiftConsoleUrl() {
        if (await Console.fetchClusterVersion() === null) {
            const routeObj = await Console.odo.execute(Command.getOpenshiftClusterRoute());
            const spec = JSON.parse(routeObj.stdout).items[0].spec;
            const consoleUrl = `${spec.port.targetPort}://${spec.host}`;
            return consoleUrl;
        } else {
            const consoleUrl = await Console.odo.execute(Command.showServerUrl());
            return consoleUrl.stdout;
        }
    }

    static async openBuildConfig(context: { id: any; }) {
        let url = '';
        if (!context) {
            vscode.window.showErrorMessage("Cannot load the build config");
            return;
        }
        const consoleUrl = await Console.fetchOpenshiftConsoleUrl();
        if (await Console.fetchClusterVersion() === null) {
            url = `${consoleUrl}/k8s/ns/${context.id}/buildconfigs`;
        } else {
            url = `${clusterUrl}/console/project/${project}/browse/builds/${context.id}?tab=history`;
        }
        return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }

    static async openDeploymentConfig(context: { id: any; }) {
        let url = '';
        if (!context) {
            vscode.window.showErrorMessage("Cannot load the deployment config");
            return;
        }
        const consoleUrl = await Console.fetchOpenshiftConsoleUrl();
        if (await Console.fetchClusterVersion() === null) {
            url = `${consoleUrl}/k8s/ns/${context.id}/deploymentconfigs`;
        } else {
            url = `${clusterUrl}/console/project/${project}/browse/dc/${context.id}?tab=history`;
        }
        return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }

    static async openImageStream(context: { id: any; }) {
        let url = '';
        if (!context) {
            vscode.window.showErrorMessage("Cannot load the image stream");
            return;
        }
        const consoleUrl = await this.fetchOpenshiftConsoleUrl();
        if (await Console.fetchClusterVersion() === null) {
            url = `${consoleUrl}/k8s/ns/${context.id}/imagestreams`;
        } else {
            url = `${clusterUrl}/console/project/${project}/browse/images/${context.id}?tab=history`;
        }
        return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }

    static async openProject(context: { id: any; }) {
        let url = '';
        if (!context) {
            vscode.window.showErrorMessage("Cannot load the Project");
            return;
        }
        const consoleUrl = await Console.fetchOpenshiftConsoleUrl();
        if (await Console.fetchClusterVersion() === null) {
            url = `${consoleUrl}/overview/ns/${context.id}`;
        } else {
            url = `${consoleUrl}/console/project/${context.id}/overview`;
        }
        return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }
}