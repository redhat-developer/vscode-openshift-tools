/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { CommandText } from '../base/command';
import { CliChannel } from '../cli';
import { isOpenShiftCluster } from '../util/kubeUtils';
import { Build } from './build';
import { ClusterServiceVersion } from './csv';
import { DeploymentConfig } from './deploymentConfig';
import path = require('path');

let clusterExplorer: k8s.ClusterExplorerV1 | undefined;

let lastNamespace = '';

async function initNamespaceName(node: k8s.ClusterExplorerV1.ClusterExplorerResourceNode): Promise<string | undefined> {
    const result = await CliChannel.getInstance().executeTool(new CommandText('oc', 'config view -o json'));
    const config = JSON.parse(result.stdout);
    const currentContext = (config.contexts || []).find((ctx) => ctx.name === node.name);
    if (!currentContext) {
        return '';
    }
    return currentContext.context.namespace || 'default';
}

async function customizeAsync(node: k8s.ClusterExplorerV1.ClusterExplorerResourceNode, treeItem: vscode.TreeItem): Promise<void> {
  if ((node as any).nodeType === 'context') {
      lastNamespace = await initNamespaceName(node);
      if (await isOpenShiftCluster()) {
          treeItem.iconPath = vscode.Uri.file(path.join(__dirname, '../../../images/context/cluster-node.png'));
      }
  }
  if (node.nodeType === 'resource' && node.resourceKind.manifestKind === 'Project') {
      // assuming now that it’s a project node
      const projectName = node.name;
      if (projectName === lastNamespace) {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
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
            clusterExplorer.nodeSources.resourceFolder('Projects', 'Projects', 'Project', 'project').if(isOpenShiftCluster).at(undefined),
            clusterExplorer.nodeSources.resourceFolder('Templates', 'Templates', 'Template', 'template').if(isOpenShiftCluster).at(undefined),
            clusterExplorer.nodeSources.resourceFolder('ImageStreams', 'ImageStreams', 'ImageStream', 'ImageStream').if(isOpenShiftCluster).at('Workloads'),
            clusterExplorer.nodeSources.resourceFolder('Routes', 'Routes', 'Route', 'route').if(isOpenShiftCluster).at('Network'),
            clusterExplorer.nodeSources.resourceFolder('DeploymentConfigs', 'DeploymentConfigs', 'DeploymentConfig', 'dc').if(isOpenShiftCluster).at('Workloads'),
            clusterExplorer.nodeSources.resourceFolder('BuildConfigs', 'BuildConfigs', 'BuildConfig', 'bc').if(isOpenShiftCluster).at('Workloads'),
            clusterExplorer.nodeSources.groupingFolder('Operators', 'Operators').if(isOpenShiftCluster).at(undefined),
            clusterExplorer.nodeSources.resourceFolder('ClusterServiceVersion', 'ClusterServiceVersions', 'ClusterServiceVersion', 'csv').if(isOpenShiftCluster).at('Operators'),
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