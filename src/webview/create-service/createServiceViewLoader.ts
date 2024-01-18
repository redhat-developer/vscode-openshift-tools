/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { randomInt } from 'crypto';
import { dump as dumpYaml, load as loadYaml } from 'js-yaml';
import { JSONSchema7 } from 'json-schema';
import * as _ from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';
import { OpenShiftExplorer } from '../../explorer';
import { ClusterServiceVersionKind, CustomResourceDefinitionKind } from '../../k8s/olm/types';
import { Oc } from '../../oc/ocWrapper';
import { getServiceKindStubs } from '../../openshift/serviceHelpers';
import { ExtensionID } from '../../util/constants';
import { loadWebviewHtml } from '../common-ext/utils';
import type {
    CustomResourceDefinitionStub,
    SpecDescriptor
} from '../common/createServiceTypes';

export default class CreateServiceViewLoader {
    private static panel: vscode.WebviewPanel;

    static get extensionPath(): string {
        return vscode.extensions.getExtension(ExtensionID).extensionPath;
    }

    static async loadView(): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(
            path.join(CreateServiceViewLoader.extensionPath, 'out', 'createServiceViewer'),
        );

        if (CreateServiceViewLoader.panel) {
            CreateServiceViewLoader.panel.reveal();
            return CreateServiceViewLoader.panel;
        }

        CreateServiceViewLoader.panel = vscode.window.createWebviewPanel(
            'createServiceView',
            'Create Service',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true,
            },
        );

        CreateServiceViewLoader.panel.iconPath = vscode.Uri.file(
            path.join(CreateServiceViewLoader.extensionPath, 'images/context/cluster-node.png'),
        );
        CreateServiceViewLoader.panel.webview.html = await loadWebviewHtml(
            'createServiceViewer',
            CreateServiceViewLoader.panel,
        );

        const colorThemeDisposable = vscode.window.onDidChangeActiveColorTheme(async function (
            colorTheme: vscode.ColorTheme,
        ) {
            await CreateServiceViewLoader.panel.webview.postMessage({
                action: 'setTheme',
                themeValue: colorTheme.kind,
            });
        });

        CreateServiceViewLoader.panel.onDidDispose(() => {
            colorThemeDisposable.dispose();
            CreateServiceViewLoader.panel = undefined;
        });

        CreateServiceViewLoader.panel.onDidDispose(() => {
            CreateServiceViewLoader.panel = undefined;
        });
        CreateServiceViewLoader.panel.webview.onDidReceiveMessage(
            CreateServiceViewLoader.messageListener,
        );
        return CreateServiceViewLoader.panel;
    }

    static async messageListener(message: { command: string; data: object }): Promise<void> {
        switch (message.command) {
            case 'ready':
                try {
                    // set theme
                    void CreateServiceViewLoader.panel.webview.postMessage({
                        action: 'setTheme',
                        themeValue: vscode.window.activeColorTheme.kind,
                    });
                    // send list of possible kinds of service to create
                    void CreateServiceViewLoader.panel.webview.postMessage({
                        action: 'setServiceKinds',
                        data: await getServiceKindStubs(),
                    });
                } catch (e) {
                    void CreateServiceViewLoader.panel.webview.postMessage({
                        action: 'error',
                        data: `${e}`,
                    });
                    void vscode.window.showErrorMessage(`${e}`);
                }
                break;
            case 'getSpec': {
                try {
                    const clusterServiceVersion = await getClusterServiceVersionFromStub(message.data as CustomResourceDefinitionStub);
                    const defaults = await getDefaultsFromServiceKindStub(
                        clusterServiceVersion,
                        message.data as CustomResourceDefinitionStub,
                    );
                    if (await Oc.Instance.canIGetCRDs()) {
                        // get the spec from the CRD
                        const spec = await getSpecFromServiceKindStub(
                            message.data as CustomResourceDefinitionStub,
                            defaults,
                        );
                        void CreateServiceViewLoader.panel.webview.postMessage({
                            action: 'setSpec',
                            data: {
                                spec,
                                defaults,
                            },
                        });
                    } else {
                        // create a new unsaved YAML file with the default data and show it to the user
                        const serviceYaml = dumpYaml(defaults);
                        const newTextDocument = await vscode.workspace.openTextDocument({ content: serviceYaml, language: 'yaml' });
                        await vscode.window.showTextDocument(newTextDocument);

                        // dispose webview and explain what happened
                        CreateServiceViewLoader.panel.dispose();
                        CreateServiceViewLoader.panel = undefined;

                        void vscode.window.showInformationMessage('Cannot access schema for the given service. Here is the YAML for the example instance');
                    }
                } catch (e) {
                    void CreateServiceViewLoader.panel.webview.postMessage({
                        action: 'error',
                        data: `${e}`,
                    });
                    void vscode.window.showErrorMessage(`${e}`);
                }
                break;
            }
            case 'create': {
                try {
                    await Oc.Instance.createKubernetesObjectFromSpec(message.data);
                    void vscode.window.showInformationMessage(`Service ${(message.data as unknown as any).metadata.name} successfully created.` );
                    CreateServiceViewLoader.panel.dispose();
                    CreateServiceViewLoader.panel = undefined;
                    OpenShiftExplorer.getInstance().refresh();
                } catch (err) {
                    void CreateServiceViewLoader.panel.webview.postMessage({
                        action: 'error',
                        data: `${err}`,
                    });
                    void vscode.window.showErrorMessage(err);
                }
                break;
            }
            default:
                void vscode.window.showErrorMessage(`Unrecognized message ${message.command}`);
        }
    }
}

/**
 * @see `csv.ts`
 */
async function getSpecFromServiceKindStub(
    stub: CustomResourceDefinitionStub,
    defaults: object | undefined,
): Promise<JSONSchema7> {
    const serviceKind = await getFullServiceKindFromStub(stub);
    const rawSchema: JSONSchema7 = serviceKind.spec.versions[0].schema.openAPIV3Schema;
    cleanseSchema(rawSchema);
    ensureRequiredPropertiesExist(rawSchema);
    removeOptionalKeysFromSchema(rawSchema.properties.spec as JSONSchema7, defaults && (defaults as any).spec);
    removeEmptyProperties(rawSchema);
    if (stub.specDescriptors) {
        addAdditionalDocumentationsToSchema(rawSchema.properties.spec as JSONSchema7, stub.specDescriptors);
    }
    return rawSchema;
}

async function getFullServiceKindFromStub(
    stub: CustomResourceDefinitionStub,
): Promise<CustomResourceDefinitionKind> {
    return (await Oc.Instance.getKubernetesObject(
        'CustomResourceDefinition',
        stub.name,
    )) as unknown as CustomResourceDefinitionKind;
}

async function getDefaultsFromServiceKindStub(clusterServiceVersion: ClusterServiceVersionKind, stub: CustomResourceDefinitionStub): Promise<object> {
    let defaults: object = {
        metadata: {
            name: `${_.kebabCase(stub.kind)}${randomInt(100)}`,
            namespace: await Oc.Instance.getActiveProject(),
        }
    };
    const examplesYaml: string =
        clusterServiceVersion.metadata?.annotations?.['alm-examples'];
    const examples: any[] = examplesYaml ? loadYaml(examplesYaml) as any[] : [];
    const example = examples.find((item) => item.kind === stub.kind);
    if (example) {
        defaults = _.merge(example, defaults);
    }
    return defaults;
}

async function getClusterServiceVersionFromStub(stub: CustomResourceDefinitionStub): Promise<ClusterServiceVersionKind> {
    const clusterServiceVersions = (await Oc.Instance.getKubernetesObjects(
        'csv',
    )) as unknown as ClusterServiceVersionKind[];

    for (const clusterServiceVersion of clusterServiceVersions) {
        if (
            clusterServiceVersion.spec.customresourcedefinitions.owned.find(
                (crdStub) => crdStub.name === stub.name,
            )
        ) {
            return clusterServiceVersion;
        }
    }
    // should never happen; if so, where did the stub come from?
    return undefined;
}

/**
 * Mutates the schema:
 * - Removes `status` as a property (not needed during custom resource creation)
 * - Adds `metadata.name` and `metadata.namespace` as properties,
 *   and adds a description for them
 */
function cleanseSchema(schema: JSONSchema7): void {

    // remove status
    delete schema.properties.status;
    if (schema.required) {
        schema.required = schema.required.filter((property) => property !== 'status');
    }

    // specify metadata
    if (!schema.properties.metadata) {
        schema.properties.metadata = { type: 'object' };
    }
    if (!(schema.properties.metadata as JSONSchema7).properties) {
        (schema.properties.metadata as JSONSchema7).properties = {};
    }
    if (!(schema.properties.metadata as JSONSchema7).properties.name) {
        (schema.properties.metadata as JSONSchema7).properties.name = {
            type: 'string',
            description: 'The name of the object that will be created',
        };
    }
    if (!(schema.properties.metadata as JSONSchema7).properties.namespace) {
        (schema.properties.metadata as JSONSchema7).properties.namespace = {
            type: 'string',
            description: 'The namespace in which the object will be created',
        };
    }
}

/**
 * Mutates the given schema to remove any non-required fields that aren't given a value by `data`
 */
function removeOptionalKeysFromSchema(schema: JSONSchema7, data?: object) {
    if (!schema || schema.type !== 'object' || !schema.properties) {
        return;
    }
    for (const key of Object.keys(schema.properties)) {
        if (!schema.required || schema.required.includes(key) || (data && data[key])) {
            removeOptionalKeysFromSchema(schema.properties[key] as JSONSchema7, data ? data[key] : undefined);
        } else {
            delete schema.properties[key];
        }
    }
}

/**
 *
 * If the schema has an entry in `required` that doesn't have a corresponding entry in `properties`,
 * then create the entry, setting its type to string
 *
 * @param schema
 */
function ensureRequiredPropertiesExist(schema: JSONSchema7) {
    if (!schema) {
        return;
    }

    // This is an object property without any specified keys
    if (schema['x-kubernetes-preserve-unknown-fields']) {
        schema.type = 'object';
        return;
    }

    if (!schema.required || !schema.required.length) {
        return;
    }

    if (!schema.type) {
        schema.type = 'object';
    }
    if (!schema.properties) {
        schema.properties = {};
    }
    for (const requiredProperty of schema.required) {
        if (!schema.properties[requiredProperty]) {
            schema.properties[requiredProperty] = {
                type: 'string',
            }
        }
    }
    for (const property of Object.keys(schema.properties)) {
        ensureRequiredPropertiesExist(schema.properties[property] as JSONSchema7);
    }
}

function addAdditionalDocumentationsToSchema(schema: JSONSchema7, specDescriptors: SpecDescriptor[]) {
    if (!schema) {
        return;
    }
    for (const specDescriptor of specDescriptors) {
        addAdditionalDocumentationToSchema(schema, specDescriptor);
    }
}

function addAdditionalDocumentationToSchema(schema: JSONSchema7, specDescriptor: SpecDescriptor) {
    if (!schema || !schema.properties) {
        return;
    }
    if (specDescriptor.path.indexOf('.') === -1 && schema.properties[specDescriptor.path]) {
        const prop = (schema.properties[specDescriptor.path] as JSONSchema7);
        if (!prop.description) {
            prop.description = specDescriptor.description;
        }
    } else {
        const firstSegment = specDescriptor.path.substring(0, specDescriptor.path.indexOf('.'));
        if (schema.properties[firstSegment]) {
            const newDescriptor: SpecDescriptor = {
                ...specDescriptor,
                path: specDescriptor.path.substring(specDescriptor.path.indexOf('.') + 1),
            };
            addAdditionalDocumentationToSchema(schema.properties[firstSegment] as JSONSchema7, newDescriptor);
        }
    }
}

function removeEmptyProperties(schema: JSONSchema7): void {

    if (!schema || schema.type !== 'object' || !schema.properties) {
        return;
    }

    for (const key of Object.keys(schema.properties)) {
        if (typeof schema.properties[key] !== 'boolean' && (schema.properties[key] as JSONSchema7).type === 'object') {
            if ((schema.properties[key] as JSONSchema7).properties && Object.keys((schema.properties[key] as JSONSchema7).properties).length) {
                removeEmptyProperties(schema.properties[key] as JSONSchema7);
            } else {
                delete schema.properties[key];
            }
        }
    }
}
