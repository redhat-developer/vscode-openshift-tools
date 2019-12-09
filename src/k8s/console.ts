/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { Command } from "../odo";
import { KubeConfigUtils } from "../util/kubeUtils";
import { OpenShiftItem } from '../openshift/openshiftItem';
import { CliExitData } from '../cli';
import * as common from './common';

const k8sConfig = new KubeConfigUtils();
const project = (k8sConfig.contexts).find((ctx) => ctx.name === k8sConfig.currentContext).namespace;

export class Console extends OpenShiftItem {

    static async openConsole(context: { name: any; }) {
        const openConsole = [
            {
                label: 'BuildConfigs',
                description: 'Select BuildConfigs too open in console'
            },
            {
                label: 'DeploymentConfigs',
                description: 'Select DeploymentConfigs too open in console'
            },
            {
                label: 'ImageStream',
                description: 'Select ImageStream too open in console'
            },
            {
                label: 'Open Project',
                description: 'Select Project too open in console'
            }
        ];
        const consoleSource = await vscode.window.showQuickPick(openConsole, {
            placeHolder: "Select source type for Component",
            ignoreFocusOut: true
        });
        if (!consoleSource) return null;
        if (consoleSource.label === 'BuildConfigs') {
            Console.openBuildConfig(context);
        } else if (consoleSource.label === 'DeploymentConfigs') {
            Console.openDeploymentConfig(context);
        } else if (consoleSource.label === 'ImageStream') {
            Console.openImageStream(context);
        } else if (consoleSource.label === 'Open Project') {
            Console.openProject(context);
        }
    }

    static async fetchOpenShiftConsoleUrl() {
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
        let buildName: string = context ? context.name : undefined;
        if (!buildName) buildName = await common.selectResourceByName(await common.getBuildConfigNames("You have no BuildConfigs available"), "Select a BuildConfig too open in console");
        if (!buildName) return null;
        const consoleUrl = await Console.fetchOpenShiftConsoleUrl();
        if (consoleUrl['stdout']) {
            url = `${Console.openShift4ClusterUrl(consoleUrl)}/k8s/ns/${project}/buildconfigs/${buildName}`;
        } else {
            url = `${consoleUrl}/console/project/${project}/browse/builds/${buildName}?tab=history`;
        }
        return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }

    static async openDeploymentConfig(context: { name: any; }) {
        let url = '';
        let deployName: string = null;
        if (context) {
            deployName = context.name;
        } else {
            deployName = await common.selectResourceByName(common.getDeploymentConfigNames("You have no DeploymentConfigs available"), "Select a DeploymentConfig");
        }
        if (!deployName) return null;
        const consoleUrl = await Console.fetchOpenShiftConsoleUrl();
        if (consoleUrl['stdout']) {
            url = `${Console.openShift4ClusterUrl(consoleUrl)}/k8s/ns/${project}/deploymentconfigs/${deployName}`;
        } else {
            url = `${consoleUrl}/console/project/${project}/browse/dc/${deployName}?tab=history`;
        }
        return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }

    static async openImageStream(context: { name: any; }) {
        let url = '';
        let imageStreamName: string = null;
        if (context) {
            imageStreamName = context.name;
        } else {
            imageStreamName = await common.selectResourceByName(common.getImageStreamNames("You have no ImageStream available"), "Select a ImageStream");
        }
        if (!imageStreamName) return null;
        const consoleUrl = await Console.fetchOpenShiftConsoleUrl();
        if (consoleUrl['stdout']) {
            url = `${Console.openShift4ClusterUrl(consoleUrl)}/k8s/ns/${project}/imagestreams/${imageStreamName}`;
        } else {
            url = `${consoleUrl}/console/project/${project}/browse/images/${imageStreamName}`;
        }
        return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }

    static async openProject(context: { name: any; }) {
        let url = '';
        const project = await common.getProject(context,
            "Select Project"
        );
        if (!project) return null;
        const consoleUrl = await Console.fetchOpenShiftConsoleUrl();
        if (consoleUrl['stdout']) {
            url = `${Console.openShift4ClusterUrl(consoleUrl)}/k8s/cluster/projects/${project.name}`;
        } else {
            url = `${consoleUrl}/console/project/${project.name}/overview`;
        }
        return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }
}