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
        if (!context) {
            vscode.window.showErrorMessage("Cannot load the build config");
            return;
        }
        const consoleUrl = await Console.fetchOpenshiftConsoleUrl();
        if (await Console.fetchClusterVersion() === null) {
            return await vscode.env.openExternal(vscode.Uri.parse(`${consoleUrl}/k8s/ns/${context.id}/buildconfigs`));
        } else {
            return await vscode.env.openExternal(vscode.Uri.parse(`${clusterUrl}/console/project/${project}/browse/builds/${context.id}?tab=history`));
        }
    }

    static async openDeploymentConfig(context: { id: any; }) {
        if (!context) {
            vscode.window.showErrorMessage("Cannot load the deployment config");
            return;
        }
        const consoleUrl = await Console.fetchOpenshiftConsoleUrl();
        if (await Console.fetchClusterVersion() === null) {
            return await vscode.env.openExternal(vscode.Uri.parse(`${consoleUrl}/k8s/ns/${context.id}/deploymentconfigs`));
        } else {
            return await vscode.env.openExternal(vscode.Uri.parse(`${clusterUrl}/console/project/${project}/browse/dc/${context.id}?tab=history`));
        }
    }

    static async openImageStream(context: { id: any; }) {
        if (!context) {
            vscode.window.showErrorMessage("Cannot load the image stream");
            return;
        }
        const consoleUrl = await this.fetchOpenshiftConsoleUrl();
        if (await Console.fetchClusterVersion() === null) {
            return await vscode.env.openExternal(vscode.Uri.parse(`${consoleUrl}/k8s/ns/${context.id}/imagestreams`));
        } else {
            return await vscode.env.openExternal(vscode.Uri.parse(`${clusterUrl}/console/project/${project}/browse/images/${context.id}?tab=history`));
        }
    }

    static async openProject(context: { id: any; }) {
        if (!context) {
            vscode.window.showErrorMessage("Cannot load the Project");
            return;
        }
        const consoleUrl = await Console.fetchOpenshiftConsoleUrl();
        if (await Console.fetchClusterVersion() === null) {
            return await vscode.env.openExternal(vscode.Uri.parse(`${consoleUrl}/overview/ns/${context.id}`));
        } else {
            return await vscode.env.openExternal(vscode.Uri.parse(`${consoleUrl}/console/project/${context.id}/overview`));
        }
    }
}