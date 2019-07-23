/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { KubeConfigUtils } from "../util/kubeUtils";
import open = require("open");

const k8sConfig = new KubeConfigUtils();
const clusterUrl = k8sConfig.getCurrentCluster().server;
const project = (k8sConfig.contexts).find((ctx) => ctx.name === k8sConfig.currentContext).namespace;

export class Console {

    static async openBuildConfig(context: { id: any; }) {
        if (!context) {
            vscode.window.showErrorMessage("Cannot load the build config");
            return;
        }
        await open(`${clusterUrl}/console/project/${project}/browse/builds/${context.id}?tab=history`);
        return;
    }

    static async openDeploymentConfig(context: { id: any; }) {
        if (!context) {
            vscode.window.showErrorMessage("Cannot load the deployment config");
            return;
        }
        await open(`${clusterUrl}/console/project/${project}/browse/dc/${context.id}?tab=history`);
        return;
    }

    static async openImageStream(context: { id: any; }) {
        if (!context) {
            vscode.window.showErrorMessage("Cannot load the image stream");
            return;
        }
        await open(`${clusterUrl}/console/project/${project}/browse/images/${context.id}?tab=history`);
        return;
    }
}