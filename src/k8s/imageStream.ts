/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { KubeConfigUtils } from "../util/kubeUtils";
import open = require("open");

export class ImageStream {

    static async openConsole(context: { id: any; }) {
        if (!context) {
            vscode.window.showErrorMessage("Cannot load the image stream");
            return;
        }
        const k8sConfig = new KubeConfigUtils();
        const clusterUrl = k8sConfig.getCurrentCluster().server;
        const project = (k8sConfig.contexts).find((ctx) => ctx.name === k8sConfig.currentContext).namespace;
        await open(`${clusterUrl}/console/project/${project}/browse/images/${context.id}?tab=history`);
        return;
    }
}