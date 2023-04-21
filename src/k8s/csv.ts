/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { TreeItem, WebviewPanel, window } from 'vscode';
import { ClusterExplorerV1 } from 'vscode-kubernetes-tools-api';
import { Oc } from '../oc/ocWrapper';
import { Odo } from '../odo/odoWrapper';
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

    static createFormMessageListener(panel: WebviewPanel) {
        return async (event: any) => {
            if (event.command === 'cancel') {
                if (event.changed === true) {
                    const choice = await window.showWarningMessage('Discard all the changes in the form?', 'Yes', 'No');
                    if (choice === 'No') {
                        return;
                    }
                }
                panel.dispose();
            }
            if (event.command === 'create') {
                // add waiting for Deployment to be created using wait --for=condition
                // no need to wait until it is available
                if (!await Odo.Instance.getActiveCluster()) {
                    // could be expired session
                    return;
                }

                try {
                    // make the service part of the app
                    event.formData.metadata.labels = {
                        app: 'app',
                        'app.kubernetes.io/part-of': 'app'
                    };
                    await Oc.Instance.createKubernetesObjectFromSpec(event.formData);
                    void window.showInformationMessage(`Service ${event.formData.metadata.name} successfully created.`);
                    panel.dispose();
                } catch (err) {
                    void window.showErrorMessage(err);
                    await panel.webview.postMessage({action: 'error'});
                }
            }
        }
    }

}
