/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { loadYaml } from '@kubernetes/client-node';
import { JSONSchema7 } from 'json-schema';
import * as _ from 'lodash';
import { TreeItem, WebviewPanel, window } from 'vscode';
import { ClusterExplorerV1 } from 'vscode-kubernetes-tools-api';
import { Oc } from '../oc/ocWrapper';
import { Odo } from '../odo/odoWrapper';
import OpenShiftItem from '../openshift/openshiftItem';
import { getOpenAPISchemaFor } from '../util/swagger';
import { vsCommand } from '../vscommand';
import CreateServiceViewLoader from '../webview/create-service/createServiceViewLoader';
import { CRDDescription, ClusterServiceVersionKind, CustomResourceDefinitionKind } from './olm/types';
import { DEFAULT_K8S_SCHEMA, generateDefaults, getUISchema, randomString } from './utils';

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

interface K8sCrdNode {
    impl: {
        crdDescription: CRDDescription;
        csv: ClusterServiceVersionKind;
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

    @vsCommand('clusters.openshift.csv.create')
    static async createNewService(crdOwnedNode: K8sCrdNode): Promise<void> {
        return ClusterServiceVersion.createNewServiceFromDescriptor(crdOwnedNode.impl.crdDescription, crdOwnedNode.impl.csv);
    }

    static async createNewServiceFromDescriptor(crdDescription: CRDDescription, csv: ClusterServiceVersionKind): Promise<void> {
        let crdResource: CustomResourceDefinitionKind;
        let apiVersion: string;
        try {
            crdResource = await Oc.Instance.getKubernetesObject('crd', crdDescription.name) as unknown as CustomResourceDefinitionKind;
        } catch (err) {
            // if crd cannot be accessed, try to use swagger
        }

        let openAPIV3SchemaAll: JSONSchema7;
        if (crdResource) {
            openAPIV3SchemaAll = crdResource.spec.versions.find((version) => version.name === crdDescription.version).schema.openAPIV3Schema;
            apiVersion = `${crdResource.spec.group}/${crdDescription.version}`;
        } else {
            const activeCluster = await this.odo.getActiveCluster();
            const token = await Oc.Instance.getCurrentUserToken();
            openAPIV3SchemaAll = await getOpenAPISchemaFor(activeCluster, token, crdDescription.kind, crdDescription.version);
            const gvk = _.find(openAPIV3SchemaAll['x-kubernetes-group-version-kind'], ({ group, version, kind }) =>
                crdDescription.version === version && crdDescription.kind === kind && group);
                apiVersion = `${gvk.group}/${gvk.version}`;
        }

        const examplesYaml: string = csv.metadata?.annotations?.['alm-examples'];
        const examples: any[] = examplesYaml ? loadYaml(examplesYaml) : undefined;
        const example = examples ? examples.find(item => item.apiVersion === apiVersion && item.kind === crdDescription.kind) : {};
        generateDefaults(openAPIV3SchemaAll, example);
        const openAPIV3Schema = _.defaultsDeep({}, DEFAULT_K8S_SCHEMA, _.omit(openAPIV3SchemaAll, 'properties.status'));
        openAPIV3Schema.properties.metadata.properties.name.default =
            example?.metadata?.name ? `${example.metadata.name}-${randomString()}` : `${crdDescription.kind}-${randomString()}`;

        const uiSchema = getUISchema(
            openAPIV3Schema,
            crdDescription
        );

        const panel = await CreateServiceViewLoader.loadView('Create Service', ClusterServiceVersion.createFormMessageListener.bind(undefined));

        panel.webview.onDidReceiveMessage(async (event)=> {
            if(event.command === 'ready') {
                await panel.webview.postMessage({
                    action: 'load', openAPIV3Schema,
                    uiSchema,
                    crdDescription,
                    formData: {}
                });
            }
        });
    }
}
