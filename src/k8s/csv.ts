/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { TreeItem } from 'vscode';
import { ClusterExplorerV1 } from 'vscode-kubernetes-tools-api';
import { Oc } from '../oc/ocWrapper';
import OpenShiftItem from '../openshift/openshiftItem';
import { CRDDescription, ClusterServiceVersionKind } from './olm/types';

class CsvNode implements ClusterExplorerV1.Node, ClusterExplorerV1.ClusterExplorerExtensionNode {

    readonly nodeType: 'extension';

    constructor(public readonly crdDescription: CRDDescription, public readonly csv: ClusterServiceVersionKind) {
    }

    getChildren(): Promise<ClusterExplorerV1.Node[]> {
        return;
    }

    getTreeItem(): TreeItem {
        const displayName = this.crdDescription.displayName? this.crdDescription.displayName : '';
        const nameVersion = `${this.crdDescription.name}/${this.crdDescription.version}`;
        const label = displayName ? `${displayName} (${nameVersion})` : nameVersion;
        return {
            label,
            contextValue:  'openshift.resource.csv.crdDescription',
            tooltip: `Name: ${this.crdDescription.name}\nVersion: ${this.crdDescription.version}\nKind: ${this.crdDescription.kind}\nDescription: ${this.crdDescription.description || 'N/A'}`
        }
    }
}

export class ClusterServiceVersion extends OpenShiftItem {
    public static command = {
        getCsv: (csvName: string): string => `get csv ${csvName}`,
        getCrd: (crdName: string): string => `get crd ${crdName}`,
        getCreateCommand: (file: string): string => `create -f ${file}`,
    };

    public static getNodeContributor(): ClusterExplorerV1.NodeContributor {
        return {
            contributesChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): boolean {
                return parent?.nodeType === 'resource' &&
                    parent?.resourceKind?.manifestKind === 'ClusterServiceVersion';
            },
            async getChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<ClusterExplorerV1.Node[]> {
                const csv: ClusterServiceVersionKind = (await Oc.Instance.getKubernetesObject('csv', (parent as any).name)) as unknown as ClusterServiceVersionKind;
                return csv.spec.customresourcedefinitions.owned.map((crd) => new CsvNode(crd, csv));
            },
        };
    }

}
