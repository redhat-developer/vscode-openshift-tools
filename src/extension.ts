/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { OpenShiftExplorer } from './explorer';
import { Cluster } from './openshift/cluster';
import { Platform } from './util/platform';
import { Build } from './k8s/build';
import { DeploymentConfig } from './k8s/deployment';
import { OdoImpl, ContextType } from './odo';
import { TokenStore } from './util/credentialManager';
import { registerCommands } from './vscommand';
import { Component } from './openshift/component';

import path = require('path');
import fsx = require('fs-extra');
import treeKill = require('tree-kill');

let clusterExplorer: k8s.ClusterExplorerV1 | undefined;
let lastNamespace = '';

async function isOpenShift(): Promise<boolean> {
  const kubectl = await k8s.extension.kubectl.v1;
  let isOS = false;
  if (kubectl.available) {
      const sr = await kubectl.api.invokeCommand('api-versions');
      isOS = sr && sr.code === 0 && sr.stdout.includes("apps.openshift.io/v1");
  }
  return isOS;
}

async function initNamespaceName(node: k8s.ClusterExplorerV1.ClusterExplorerResourceNode): Promise<string | undefined> {
  const kubectl = await k8s.extension.kubectl.v1;
  if (kubectl.available) {
      const result = await kubectl.api.invokeCommand('config view -o json');
      const config = JSON.parse(result.stdout);
      const currentContext = (config.contexts || []).find((ctx) => ctx.name === node.name);
      if (!currentContext) {
          return '';
      }
      return currentContext.context.namespace || 'default';
  }
}

async function customizeAsync(node: k8s.ClusterExplorerV1.ClusterExplorerResourceNode, treeItem: vscode.TreeItem): Promise<void> {
  if ((node as any).nodeType === 'context') {
      lastNamespace = await initNamespaceName(node);
      if (await isOpenShift()) {
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

function customize(node: k8s.ClusterExplorerV1.ClusterExplorerResourceNode, treeItem: vscode.TreeItem): Thenable<void> {
    return customizeAsync(node, treeItem);
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
// this method is called when your extension is deactivated
export function deactivate(): void {
    // intentionally left blank
}

function migrateFromOdo018(): void {
  const newCfgDir = path.join(Platform.getUserHomePath(), '.odo');
  const newCfg = path.join(newCfgDir, 'odo-config.yaml');
  const oldCfg = path.join(Platform.getUserHomePath(), '.kube', 'odo');
  if (!fsx.existsSync(newCfg) && fsx.existsSync(oldCfg)) {
      fsx.ensureDirSync(newCfgDir);
      fsx.copyFileSync(oldCfg, newCfg);
  }
}

export async function activate(extensionContext: vscode.ExtensionContext): Promise<void> {
    migrateFromOdo018();
    Cluster.extensionContext = extensionContext;
    Component.extensionContext = extensionContext;
    TokenStore.extensionContext = extensionContext;
    const disposable = [
        ...await registerCommands(
            './openshift/catalog',
            './oc',
            './k8s/console',
            './openshift/service',
            './openshift/url',
            './openshift/storage',
            './openshift/application',
            './openshift/project',
            './k8s/route'),
        vscode.commands.registerCommand('clusters.openshift.useProject', (context) => vscode.commands.executeCommand('extension.vsKubernetesUseNamespace', context)),
        OpenShiftExplorer.getInstance()
    ];
    disposable.forEach((value) => extensionContext.subscriptions.push(value));

    // TODO: Implement the case when 'odo watch' is running for component and push would be done automatically
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    OdoImpl.Instance.subject.subscribe(async (event) => {
        if (event.type === 'inserted' && event.data.contextValue === ContextType.COMPONENT) {
            const choice = await vscode.window.showInformationMessage(`Do you want to push new '${event.data.getName()}' Component?`, 'Push');
            if (choice === 'Push') {
                await vscode.commands.executeCommand('openshift.component.push', event.data);
                OpenShiftExplorer.getInstance().refresh(event.data);
            }
        } else if (event.type === 'inserted' && (event.data.contextValue === ContextType.COMPONENT_ROUTE || event.data.contextValue === ContextType.STORAGE)) {
            const choice = await vscode.window.showInformationMessage(`Do you want to push changes for '${event.data.getParent().getName()}' Component?`, 'Push');
            if (choice === 'Push') {
                await vscode.commands.executeCommand('openshift.component.push', event.data.getParent(), true);
                OpenShiftExplorer.getInstance().refresh(event.data.getParent());
            }
        }
    });

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
            Build.getNodeContributor(),
            DeploymentConfig.getNodeContributor()
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
    extensionContext.subscriptions.push(vscode.debug.onDidTerminateDebugSession(session => {
        if (session.configuration.odoPid) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            treeKill(session.configuration.odoPid);
        }
    }));
}
