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
import { BuildConfigNodeContributor } from './k8s/build';
import { DeploymentConfigNodeContributor } from './k8s/deployment';
import { Console } from './k8s/console';
import { OdoImpl } from './odo';
import { Build } from './k8s/build';
import * as Deployment from './k8s/deployment';
import { TokenStore } from './util/credentialManager';

let clusterExplorer: k8s.ClusterExplorerV1 | undefined = undefined;

export async function activate(context: vscode.ExtensionContext) {
    migrateFromOdo018();
    Cluster.extensionContext = Component.extensionContext = TokenStore.extensionContext = context;
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
        vscode.commands.registerCommand('openshift.explorer.switchContext', (context) => execute(Cluster.switchContext, context)),
        vscode.commands.registerCommand('openshift.catalog.listComponents', (context) => execute(Catalog.listComponents, context)),
        vscode.commands.registerCommand('openshift.catalog.listServices', (context) => execute(Catalog.listServices, context)),
        vscode.commands.registerCommand('openshift.project.create', (context) => execute(Project.create, context)),
        vscode.commands.registerCommand('openshift.project.delete', (context) => execute(Project.del, context)),
        vscode.commands.registerCommand('openshift.component.undeploy', (context) => execute(Component.undeploy, context)),
        vscode.commands.registerCommand('openshift.component.undeploy.palette', (context) => execute(Component.undeploy, context)),
        vscode.commands.registerCommand('openshift.project.delete.palette', (context) => execute(Project.del, context)),
        vscode.commands.registerCommand('openshift.app.delete.palette', (context) => execute(Application.del, context)),
        vscode.commands.registerCommand('openshift.app.describe', (context) => execute(Application.describe, context)),
        vscode.commands.registerCommand('openshift.app.describe.palette', (context) => execute(Application.describe, context)),
        vscode.commands.registerCommand('openshift.app.delete', (context) => execute(Application.del, context)),
        vscode.commands.registerCommand('openshift.component.describe', (context) => execute(Component.describe, context)),
        vscode.commands.registerCommand('openshift.component.describe.palette', (context) => execute(Component.describe, context)),
        vscode.commands.registerCommand('openshift.component.create', (context) => execute(Component.create, context)),
        vscode.commands.registerCommand('clusters.openshift.build.start', (context) => execute(Build.startBuild, context)),
        vscode.commands.registerCommand('clusters.openshift.deploy', (context) => execute(Deployment.deploy, context)),
        vscode.commands.registerCommand('clusters.openshift.build.showLog', (context) => execute(Build.showLog, context)),
        vscode.commands.registerCommand('clusters.openshift.build.followLog', (context) => execute(Build.followLog, context)),
        vscode.commands.registerCommand('clusters.openshift.build.delete', (context) => execute(Build.delete, context)),
        vscode.commands.registerCommand('clusters.openshift.build.delete.palette', (context) => execute(Build.delete, context)),
        vscode.commands.registerCommand('clusters.openshift.build.rebuild', (context) => execute(Build.rebuild, context)),
        vscode.commands.registerCommand('clusters.openshift.build.openConsole', (context) => execute(Console.openBuildConfig, context)),
        vscode.commands.registerCommand('clusters.openshift.deployment.openConsole', (context) => execute(Console.openDeploymentConfig, context)),
        vscode.commands.registerCommand('clusters.openshift.imagestream.openConsole', (context) => execute(Console.openImageStream, context)),
        vscode.commands.registerCommand('clusters.openshift.project.openConsole', (context) => execute(Console.openProject, context)),
        vscode.commands.registerCommand('openshift.component.createFromLocal', (context) => execute(Component.createFromLocal, context)),
        vscode.commands.registerCommand('openshift.component.createFromGit', (context) => execute(Component.createFromGit, context)),
        vscode.commands.registerCommand('openshift.component.createFromBinary', (context) => execute(Component.createFromBinary, context)),
        vscode.commands.registerCommand('openshift.component.delete.palette', (context) => execute(Component.del, context)),
        vscode.commands.registerCommand('openshift.component.push', (context) => execute(Component.push, context)),
        vscode.commands.registerCommand('openshift.component.lastPush', (context) => execute(Component.lastPush, context)),
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
        vscode.commands.registerCommand('openshift.component.unlink', (context) => execute(Component.unlink, context)),
        vscode.commands.registerCommand('openshift.component.unlink.component.palette', (context) => execute(Component.unlinkComponent, context)),
        vscode.commands.registerCommand('openshift.component.unlink.service.palette', (context) => execute(Component.unlinkService, context)),
        vscode.commands.registerCommand('openshift.component.linkService', (context) => execute(Component.linkService, context)),
        vscode.commands.registerCommand('openshift.explorer.reportIssue', () => OpenShiftExplorer.reportIssue()),
        vscode.commands.registerCommand('clusters.openshift.useProject', (context) => vscode.commands.executeCommand('extension.vsKubernetesUseNamespace', context)),
        OpenShiftExplorer.getInstance()
    ];
    disposable.forEach((value) => context.subscriptions.push(value));

    const clusterExplorerAPI = await k8s.extension.clusterExplorer.v1;

    if (clusterExplorerAPI.available) {
        clusterExplorer = clusterExplorerAPI.api;
        const nodeContributors = [
            clusterExplorer.nodeSources.resourceFolder("Projects", "Projects", "Project", "project").if(isOpenShift).at(undefined),
            clusterExplorer.nodeSources.resourceFolder("Templates", "Templates", "Template", "template").if(isOpenShift).at(undefined),
            clusterExplorer.nodeSources.resourceFolder("ImageStreams", "ImageStreams", "ImageStream", "ImageStream").if(isOpenShift).at("Workloads"),
            clusterExplorer.nodeSources.resourceFolder("Routes", "Routes", "Route", "route").if(isOpenShift).at("Network"),
            clusterExplorer.nodeSources.resourceFolder("DeploymentConfigs", "DeploymentConfigs", "DeploymentConfig", "dc").if(isOpenShift).at("Workloads"),
            clusterExplorer.nodeSources.resourceFolder("BuildConfigs", "BuildConfigs", "BuildConfig", "bc").if(isOpenShift).at("Workloads"),
            new BuildConfigNodeContributor(),
            new DeploymentConfigNodeContributor()
        ];
        nodeContributors.forEach(element => {
            clusterExplorer.registerNodeContributor(element);
        });
        clusterExplorer.registerNodeUICustomizer({customize});
    }
    vscode.workspace.onDidChangeWorkspaceFolders((event: vscode.WorkspaceFoldersChangeEvent) => {
        OdoImpl.Instance.loadWorkspaceComponents(event);
    });
    OdoImpl.Instance.loadWorkspaceComponents(null);
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
        if (isOpenShift()) {
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
    if (node.nodeType === 'resource' && (node.resourceKind.manifestKind === 'BuildConfig' || node.resourceKind.manifestKind === 'DeploymentConfig')) {
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