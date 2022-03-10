/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { Build } from './build';
import { DeploymentConfig } from './deploymentConfig';
import path = require('path');
import { ClusterServiceVersion } from './csv';

let clusterExplorer: k8s.ClusterExplorerV1 | undefined;

let lastNamespace = '';

async function isOpenShift(): Promise<boolean> {
  const kubectl = await k8s.extension.kubectl.v1;
  let isOS = false;
  if (kubectl.available) {
      const sr = await kubectl.api.invokeCommand('api-versions');
      isOS = sr && sr.code === 0 && sr.stdout.includes('apps.openshift.io/v1');
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
          treeItem.iconPath = vscode.Uri.file(path.join(__dirname, '../../../images/context/cluster-node.png'));
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

export async function extendClusterExplorer(): Promise<void> {
    const clusterExplorerAPI = await k8s.extension.clusterExplorer.v1_1;

    if (clusterExplorerAPI.available) {
        clusterExplorer = clusterExplorerAPI.api;
        const nodeContributors = [
            clusterExplorer.nodeSources.resourceFolder('Projects', 'Projects', 'Project', 'project').if(isOpenShift).at(undefined),
            clusterExplorer.nodeSources.resourceFolder('Templates', 'Templates', 'Template', 'template').if(isOpenShift).at(undefined),
            clusterExplorer.nodeSources.resourceFolder('ImageStreams', 'ImageStreams', 'ImageStream', 'ImageStream').if(isOpenShift).at('Workloads'),
            clusterExplorer.nodeSources.resourceFolder('Routes', 'Routes', 'Route', 'route').if(isOpenShift).at('Network'),
            clusterExplorer.nodeSources.resourceFolder('DeploymentConfigs', 'DeploymentConfigs', 'DeploymentConfig', 'dc').if(isOpenShift).at('Workloads'),
            clusterExplorer.nodeSources.resourceFolder('BuildConfigs', 'BuildConfigs', 'BuildConfig', 'bc').if(isOpenShift).at('Workloads'),
            clusterExplorer.nodeSources.groupingFolder('Operators', 'Operators').if(isOpenShift).at(undefined),
            clusterExplorer.nodeSources.resourceFolder('ClusterServiceVersion', 'ClusterServiceVersions', 'ClusterServiceVersion', 'csv').if(isOpenShift).at('Operators'),
            Build.getNodeContributor(),
            DeploymentConfig.getNodeContributor(),
            ClusterServiceVersion.getNodeContributor()
        ];
        nodeContributors.forEach(element => {
            clusterExplorer.registerNodeContributor(element);
        });
        clusterExplorer.registerNodeUICustomizer({customize});
    }
}