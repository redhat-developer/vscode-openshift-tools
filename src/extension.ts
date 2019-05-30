/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { OpenShiftExplorer } from './explorer';
import { Cluster } from './openshift/cluster';
import { Catalog } from './openshift/catalog';
import { Project } from './openshift/project';
import { Application } from './openshift/application';
import { Component } from './openshift/component';
import { Storage } from './openshift/storage';
import { Url } from './openshift/url';
import { Service } from './openshift/service';
import { Platform } from './util/platform';
import path = require('path');
import fsx = require('fs-extra');
import * as k8s from 'vscode-kubernetes-tools-api';
import { ClusterExplorerV1 } from 'vscode-kubernetes-tools-api';
import { DeploymentConfigNodeContributor } from './k8s/deployment';

export let contextGlobalState: vscode.ExtensionContext;

export async function activate(context: vscode.ExtensionContext) {
    contextGlobalState = context;
    migrateFromOdo018();

    const disposable = [
        vscode.commands.registerCommand('openshift.about', (context) => execute(Cluster.about, context)),
        vscode.commands.registerCommand('openshift.output', (context) => execute(Cluster.showOpenShiftOutput, context)),
        vscode.commands.registerCommand('openshift.openshiftConsole', (context) => execute(Cluster.openshiftConsole, context)),
        vscode.commands.registerCommand('openshift.openshiftConsole.palette', (context) => execute(Cluster.openshiftConsole, context)),
        vscode.commands.registerCommand('openshift.explorer.login', (context) => execute(Cluster.login, context)),
        vscode.commands.registerCommand('openshift.explorer.login.tokenLogin', (context) => execute(Cluster.tokenLogin, context)),
        vscode.commands.registerCommand('openshift.explorer.login.credentialsLogin', (context) => execute(Cluster.credentialsLogin, context)),
        vscode.commands.registerCommand('openshift.explorer.logout', (context) => execute(Cluster.logout, context)),
        vscode.commands.registerCommand('openshift.explorer.refresh', (context) => execute(Cluster.refresh, context)),
        vscode.commands.registerCommand('openshift.catalog.listComponents', (context) => execute(Catalog.listComponents, context)),
        vscode.commands.registerCommand('openshift.catalog.listServices', (context) => execute(Catalog.listServices, context)),
        vscode.commands.registerCommand('openshift.project.create', (context) => execute(Project.create, context)),
        vscode.commands.registerCommand('openshift.project.delete', (context) => execute(Project.del, context)),
        vscode.commands.registerCommand('openshift.project.delete.palette', (context) => execute(Project.del, context)),
        vscode.commands.registerCommand('openshift.app.delete.palette', (context) => execute(Application.del, context)),
        vscode.commands.registerCommand('openshift.app.describe', (context) => execute(Application.describe, context)),
        vscode.commands.registerCommand('openshift.app.describe.palette', (context) => execute(Application.describe, context)),
        vscode.commands.registerCommand('openshift.app.create', (context) => execute(Application.create, context)),
        vscode.commands.registerCommand('openshift.app.delete', (context) => execute(Application.del, context)),
        vscode.commands.registerCommand('openshift.component.describe', (context) => execute(Component.describe, context)),
        vscode.commands.registerCommand('openshift.component.describe.palette', (context) => execute(Component.describe, context)),
        vscode.commands.registerCommand('openshift.component.folder.create', (context) => execute(Component.createFromFolder, context)),
        vscode.commands.registerCommand('openshift.component.create', (context) => execute(Component.create, context)),
        vscode.commands.registerCommand('openshift.component.create.local', (context) => execute(Component.createFromLocal, context)),
        vscode.commands.registerCommand('openshift.component.create.git', (context) => execute(Component.createFromGit, context)),
        vscode.commands.registerCommand('openshift.component.create.binary', (context) => execute(Component.createFromBinary, context)),
        vscode.commands.registerCommand('openshift.component.delete.palette', (context) => execute(Component.del, context)),
        vscode.commands.registerCommand('openshift.component.push', (context) => execute(Component.push, context)),
        vscode.commands.registerCommand('openshift.component.push.palette', (context) => execute(Component.push, context)),
        vscode.commands.registerCommand('openshift.component.watch', (context) => execute(Component.watch, context)),
        vscode.commands.registerCommand('openshift.component.watch.palette', (context) => execute(Component.watch, context)),
        vscode.commands.registerCommand('openshift.component.log', (context) => execute(Component.log, context)),
        vscode.commands.registerCommand('openshift.component.log.palette', (context) => execute(Component.log, context)),
        vscode.commands.registerCommand('openshift.component.followLog', (context) => execute(Component.followLog, context)),
        vscode.commands.registerCommand('openshift.component.followLog.palette', (context) => execute(Component.followLog, context)),
        vscode.commands.registerCommand('openshift.component.openUrl', (context) => execute(Component.openUrl, context)),
        vscode.commands.registerCommand('openshift.component.openUrl.palette', (context) => execute(Component.openUrl, context)),
        vscode.commands.registerCommand('openshift.component.delete', (context) => execute(Component.del, context)),
        vscode.commands.registerCommand('openshift.storage.create', (context) => execute(Storage.create, context)),
        vscode.commands.registerCommand('openshift.storage.delete.palette', (context) => execute(Storage.del, context)),
        vscode.commands.registerCommand('openshift.storage.delete', (context) => execute(Storage.del, context)),
        vscode.commands.registerCommand('openshift.url.create', (context) => execute(Url.create, context)),
        vscode.commands.registerCommand('openshift.url.delete', (context) => execute(Url.del, context)),
        vscode.commands.registerCommand('openshift.url.delete.palette', (context) => execute(Url.del, context)),
        vscode.commands.registerCommand('openshift.url.open', (context) => execute(Url.open, context)),
        vscode.commands.registerCommand('openshift.service.create', (context) => execute(Service.create, context)),
        vscode.commands.registerCommand('openshift.service.delete', (context) => execute(Service.del, context)),
        vscode.commands.registerCommand('openshift.service.delete.palette', (context) => execute(Service.del, context)),
        vscode.commands.registerCommand('openshift.service.describe', (context) => execute(Service.describe, context)),
        vscode.commands.registerCommand('openshift.service.describe.palette', (context) => execute(Service.describe, context)),
        vscode.commands.registerCommand('openshift.component.linkComponent', (context) => execute(Component.linkComponent, context)),
        vscode.commands.registerCommand('openshift.component.linkService', (context) => execute(Component.linkService, context)),
        vscode.commands.registerCommand('openshift.useProject', (context) => vscode.commands.executeCommand('extension.vsKubernetesUseNamespace', context)),
        OpenShiftExplorer.getInstance()
    ];
    disposable.forEach((value) => context.subscriptions.push(value));

    const clusterExplorer = await k8s.extension.clusterExplorer.v1;

    if (clusterExplorer.available) {
        const nodeContributors = [
            clusterExplorer.api.nodeSources.resourceFolder("Projects", "Projects", "Project", "project").if(isOpenShift).at(undefined),
            clusterExplorer.api.nodeSources.resourceFolder("Templates", "Templates", "Template", "template").if(isOpenShift).at(undefined),
            clusterExplorer.api.nodeSources.resourceFolder("ImageStreams", "ImageStreams", "ImageStream", "ImageStream").if(isOpenShift).at("Workloads"),
            clusterExplorer.api.nodeSources.resourceFolder("Routes", "Routes", "Route", "route").if(isOpenShift).at("Network"),
            clusterExplorer.api.nodeSources.resourceFolder("DeploymentConfigs", "DeploymentConfigs", "DeploymentConfig", "dc").if(isOpenShift).at("Workloads"),
            clusterExplorer.api.nodeSources.resourceFolder("BuildConfigs", "BuildConfigs", "BuildConfig", "bc").if(isOpenShift).at("Workloads"),
            new DeploymentConfigNodeContributor()
        ];
        nodeContributors.forEach(element => {
            clusterExplorer.api.registerNodeContributor(element);
        });
        clusterExplorer.api.registerNodeUICustomizer({customize});
    }
}

let lastNamespace = '';

function customize(node: ClusterExplorerV1.ClusterExplorerResourceNode, treeItem: vscode.TreeItem): void | Thenable<void> {
    return customizeAsync(node, treeItem);
}

async function initNamespaceName(node: ClusterExplorerV1.ClusterExplorerResourceNode) {
    const kubectl = await k8s.extension.kubectl.v1;
    if (kubectl.available) {
        const result = await kubectl.api.invokeCommand('config view -o json');
        const config = JSON.parse(result.stdout);
        const ctxName = config["current-context"];
        const currentContext = (config.contexts || []).find((ctx) => ctx.name === node.name);
        if (!currentContext) {
            return "";
        }
        return currentContext.context.namespace || "default";
    }
}

async function customizeAsync(node: ClusterExplorerV1.ClusterExplorerResourceNode, treeItem: vscode.TreeItem): Promise<void> {
    if ((node as any).nodeType === 'context') {
        lastNamespace = await initNamespaceName(node);
        if(isOpenShift()) {
            treeItem.iconPath = vscode.Uri.file(path.join(__dirname, "../../images/context/cluster-node.png"));
        }
    }
    if (node.nodeType === 'resource' && node.resourceKind.manifestKind === 'Project') {
        // assuming now that it’s a project node
        const projectName = node.name;
        if (projectName === lastNamespace) {
            treeItem.label = `* ${treeItem.label}`;
        } else {
            treeItem.contextValue = `${treeItem.contextValue || ''}.openshift.inactiveProject`;
        }
    }
    if (node.nodeType === 'resource' && node.resourceKind.manifestKind === 'BuildConfig') {
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    }
}

async function isOpenShift(): Promise<boolean> {
    const kubectl = await k8s.extension.kubectl.v1;
    if (kubectl.available) {
        const sr = await kubectl.api.invokeCommand('api-versions');
        if (!sr || sr.code !== 0) {
            return false;
        }
        return sr.stdout.includes("apps.openshift.io/v1");  // Naive check to keep example simple!
    }
}

// this method is called when your extension is deactivated
export function deactivate() {
}

function execute<T>(command: (...args: T[]) => Promise<any> | void, ...params: T[]) {
    try {
        const res = command.call(null, ...params);
        return res && res.then
            ? res.then((result: any) => {
                displayResult(result);

            }).catch((err: any) => {
                vscode.window.showErrorMessage(err.message ? err.message : err);
            })
            : undefined;
    } catch (err) {
        vscode.window.showErrorMessage(err);
    }
}

function displayResult(result?: any) {
    if (result && typeof result === 'string') {
        vscode.window.showInformationMessage(result);
    }
}

function migrateFromOdo018() {
    const newCfgDir = path.join(Platform.getUserHomePath(), '.odo');
    const newCfg = path.join(newCfgDir, 'odo-config.yaml');
    const oldCfg = path.join(Platform.getUserHomePath(), '.kube', 'odo');
    if (!fsx.existsSync(newCfg) && fsx.existsSync(oldCfg)) {
        fsx.ensureDirSync(newCfgDir);
        fsx.copyFileSync(oldCfg, newCfg);
    }
}