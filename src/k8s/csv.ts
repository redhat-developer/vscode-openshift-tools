/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as _ from 'lodash';
import * as fs from 'fs';
import OpenShiftItem from '../openshift/openshiftItem';
import { ClusterExplorerV1 } from 'vscode-kubernetes-tools-api';
import * as common from './common';
import { ClusterServiceVersionKind, CRDDescription, CustomResourceDefinitionKind } from './olm/types';
import { TreeItem, WebviewPanel, window } from 'vscode';
import { vsCommand } from '../vscommand';
import CreateServiceViewLoader from '../webview/create-service/createServiceViewLoader';
import { DEFAULT_K8S_SCHEMA, getUISchema, randomString, generateDefaults } from './utils';
import { loadYaml } from '@kubernetes/client-node';
import { JSONSchema7 } from 'json-schema';


const tempfile = require('tmp');

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
        getCsv(csvName: string): string {
            return `get csv ${csvName}`;
        },
        getCrd(crdName: string): string {
            return `get crd ${crdName}`;
        },
        getCreateCommand(file: string): string {
            return `create -f ${file}`;
        }
    };

    public static getNodeContributor(): ClusterExplorerV1.NodeContributor {
        return {
            contributesChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): boolean {
                return parent?.nodeType === 'resource' &&
                    parent?.resourceKind?.manifestKind === 'ClusterServiceVersion';
            },
            async getChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<ClusterExplorerV1.Node[]> {
                const getCsvCmd = ClusterServiceVersion.command.getCsv((parent as any).name);
                const csv: ClusterServiceVersionKind = await common.asJson(getCsvCmd);
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
                // serialize event.formData to temporary file
                const jsonString = JSON.stringify(event.formData, null, 4);
                const tempJsonFile = tempfile.fileSync({postfix: '.json'});
                fs.writeFileSync(tempJsonFile.name, jsonString);
                // call oc create -f path/to/file until odo does support creating services without component
                const result = await common.execKubectl(ClusterServiceVersion.command.getCreateCommand(tempJsonFile.name));
                if (result.code) {
                    window.showErrorMessage(result.stdout);
                } else {
                    window.showInformationMessage(result.stdout);
                }
                // if oc exit without error close the form
                // show error message in case of error and keep form open
            }
        }
    }

    @vsCommand('clusters.openshift.csv.create')
    static async createNewService(crdOwnedNode: K8sCrdNode): Promise<void> {
        const crdDescription:CRDDescription = crdOwnedNode.impl.crdDescription;
        const getCrdCmd = ClusterServiceVersion.command.getCrd(crdOwnedNode.impl.crdDescription.name);
        const crdResouce: CustomResourceDefinitionKind = await common.asJson(getCrdCmd);

        const openAPIV3SchemaAll: JSONSchema7 = crdResouce.spec.versions.find((version) => version.name === crdDescription.version).schema.openAPIV3Schema;
        const examplesYaml: string = crdOwnedNode.impl.csv.metadata?.annotations?.['alm-examples'];
        const examples: any[] = examplesYaml ? loadYaml(examplesYaml) : undefined;
        const example = examples ? examples.find(item => item.apiVersion === `${crdResouce.spec.group}/${crdDescription.version}` && item.kind === crdResouce.spec.names.kind) : {};
        generateDefaults(openAPIV3SchemaAll, example);
        const openAPIV3Schema = _.defaultsDeep({}, DEFAULT_K8S_SCHEMA, _.omit(openAPIV3SchemaAll, 'properties.status'));
        openAPIV3Schema.properties.metadata.properties.name.default =
            example?.metadata.name ? `${example.metadata.name}-${randomString()}` : `${crdDescription.kind}-${randomString()}`;

        const uiSchema = getUISchema(
            openAPIV3Schema,
            crdDescription
        );

        const panel = await CreateServiceViewLoader.loadView('Create Service', ClusterServiceVersion.createFormMessageListener);

        panel.webview.onDidReceiveMessage(async ()=> {
            await panel.webview.postMessage(
                {action: 'load', openAPIV3Schema, uiSchema, crdDescription, formData: {}}
            );
        });
    }
}