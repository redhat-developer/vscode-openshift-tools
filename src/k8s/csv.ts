/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import OpenShiftItem from '../openshift/openshiftItem';
import { ClusterExplorerV1 } from 'vscode-kubernetes-tools-api';
import * as common from './common';
import { ClusterServiceVersionKind, CRDDescription } from './olm/types';
import { TreeItem } from 'vscode';

class CsvNode implements ClusterExplorerV1.Node, ClusterExplorerV1.ClusterExplorerExtensionNode {

    readonly nodeType: 'extension';

    constructor(public readonly crdDescription: CRDDescription) {
    }

    getChildren(): Promise<ClusterExplorerV1.Node[]> {
        return;
    }

    getTreeItem(): TreeItem {
        return {
            label: this.crdDescription.displayName,
            contextValue:  'openshift.resource.csv.crdDescription'
        }
    }
}

export class ClusterServiceVersion extends OpenShiftItem {
    public static command = {
        getCsv(csvName: string): string {
            return `get csv ${csvName}`
        },
        getCrd(crdName: string): string {
            return `get crd ${crdName}`
        },
    };

    public static getNodeContributor(): ClusterExplorerV1.NodeContributor {
        return {
            contributesChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): boolean {
                return parent?.nodeType === 'resource' &&
                    parent?.resourceKind?.manifestKind === 'ClusterServiceVersion';
            },
            async getChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<ClusterExplorerV1.Node[]> {
                const getCsvCmd = ClusterServiceVersion.command.getCsv((parent as any).name);
                const result: ClusterServiceVersionKind = await common.asJson(getCsvCmd);
                return result.spec.customresourcedefinitions.owned.map((crd) => new CsvNode(crd));
            },
        };
    }
}