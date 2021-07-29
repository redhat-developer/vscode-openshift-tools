/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandOption, CommandText } from '../odo/command';
import { Component } from '../openshift/component';
import OpenShiftItem from '../openshift/openshiftItem';
import { vsCommand } from '../vscommand';
import { ClusterExplorerV1 } from 'vscode-kubernetes-tools-api';
import * as common from './common';

export class CustomResourceDefinition extends OpenShiftItem {

    public static command = {
        getCrd (crdName: string): CommandText {
            return new CommandText('oc get crd', crdName, [new CommandOption('-o', 'json')]);
        }
    }

    static getNodeContributor(): ClusterExplorerV1.NodeContributor {
        return {
          contributesChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): boolean {
            return !!parent && parent.nodeType === 'resource' && parent.resourceKind.manifestKind === 'CustomResourceDefinition';
          },
          async getChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<ClusterExplorerV1.Node[]> {
            return common.getChildrenNode(CustomResourceDefinition.command.getReplicationControllers(parent), 'ReplicationController', 'rc');
          }
        };
      }

    @vsCommand('openshift.oc.get')
    static getCustomResourceDefinition(definition: any): Promise<void> {
        Component.odo.executeInTerminal(
            CustomResourceDefinition.command.getCrd(definition.id)
        );
        return;
    }
}