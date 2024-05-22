/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as _ from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';
import { OpenShiftExplorer } from '../../explorer';
import { Oc } from '../../oc/ocWrapper';
import { ExtensionID } from '../../util/constants';
import { loadWebviewHtml, validateName, validatePath, validateURL } from '../common-ext/utils';
import { getServices as getService } from '../../openshift/serviceHelpers';
import type { CreateRoute } from '../common/route';

export default class CreateRouteViewLoader {
    private static panel: vscode.WebviewPanel;

    static get extensionPath(): string {
        return vscode.extensions.getExtension(ExtensionID).extensionPath;
    }

    static async loadView(): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(
            path.join(CreateRouteViewLoader.extensionPath, 'out', 'create-route', 'app'),
        );

        if (CreateRouteViewLoader.panel) {
            CreateRouteViewLoader.panel.reveal();
            return CreateRouteViewLoader.panel;
        }

        CreateRouteViewLoader.panel = vscode.window.createWebviewPanel(
            'createRouteView',
            'Create Route',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true,
            },
        );

        CreateRouteViewLoader.panel.iconPath = vscode.Uri.file(
            path.join(CreateRouteViewLoader.extensionPath, 'images/context/cluster-node.png'),
        );
        CreateRouteViewLoader.panel.webview.html = await loadWebviewHtml(
            'create-route',
            CreateRouteViewLoader.panel,
        );

        const colorThemeDisposable = vscode.window.onDidChangeActiveColorTheme(async function (
            colorTheme: vscode.ColorTheme,
        ) {
            await CreateRouteViewLoader.panel.webview.postMessage({
                action: 'setTheme',
                themeValue: colorTheme.kind,
            });
        });

        CreateRouteViewLoader.panel.onDidDispose(() => {
            colorThemeDisposable.dispose();
            CreateRouteViewLoader.panel = undefined;
        });

        CreateRouteViewLoader.panel.onDidDispose(() => {
            CreateRouteViewLoader.panel = undefined;
        });
        CreateRouteViewLoader.panel.webview.onDidReceiveMessage(
            CreateRouteViewLoader.messageListener,
        );
        return CreateRouteViewLoader.panel;
    }

    static async messageListener(message: { command: string; data: object }): Promise<void> {
        switch (message.command) {
            case 'ready':
                try {
                    // set theme
                    void CreateRouteViewLoader.panel.webview.postMessage({
                        action: 'setTheme',
                        themeValue: vscode.window.activeColorTheme.kind,
                    });
                    // send list of possible kinds of service to create
                    void CreateRouteViewLoader.panel.webview.postMessage({
                        action: 'setServiceKinds',
                        data: await getService(),
                    });
                } catch (e) {
                    void CreateRouteViewLoader.panel.webview.postMessage({
                        action: 'error',
                        data: `${e}`,
                    });
                    void vscode.window.showErrorMessage(`${e}`);
                }
                break;
            case 'getSpec': {
                try {
                    const services = await getService();
                    console.log(services);
                    void CreateRouteViewLoader.panel.webview.postMessage({
                        action: 'setSpec',
                        data: {
                            services
                        },
                    });
                } catch (e) {
                    void CreateRouteViewLoader.panel.webview.postMessage({
                        action: 'error',
                        data: `${e}`,
                    });
                    void vscode.window.showErrorMessage(`${e}`);
                }
                break;
            }
            case 'create': {
                try {
                    const route: CreateRoute = message.data as CreateRoute;
                    const port = {
                        name: route.port.name,
                        number: route.port.number,
                        protocol: route.port.protocal
                    }
                    await Oc.Instance.createRoute(route.routeName, route.serviceName, route.hostname, route.path, port, route.isSecured);
                    void vscode.window.showInformationMessage(`Route ${route.routeName}} successfully created.`);
                    CreateRouteViewLoader.panel.dispose();
                    CreateRouteViewLoader.panel = undefined;
                    OpenShiftExplorer.getInstance().refresh();
                } catch (err) {
                    void CreateRouteViewLoader.panel.webview.postMessage({
                        action: 'error',
                        data: `${err}`,
                    });
                    void vscode.window.showErrorMessage(err);
                }
                break;
            }
            case 'validateRouteName': {
                const flag = validateName(message.data.toString());
                void CreateRouteViewLoader.panel.webview.postMessage({
                    action: 'validateRouteName',
                    data: {
                        error: !flag ? false : true,
                        helpText: !flag ? '' : flag,
                        name: message.data.toString()
                    }
                });
                break;
            }
            case 'validateHost': {
                if (message.data.toString().trim() === '') {
                    void CreateRouteViewLoader.panel.webview.postMessage({
                        action: 'validateHost',
                        data: {
                            error: false,
                            helpText: '',
                            name: message.data.toString()
                        }
                    });
                    break;
                }
                const flag = validateURL(message, false);
                void CreateRouteViewLoader.panel.webview.postMessage({
                    action: 'validateHost',
                    data: {
                        error: !flag.error ? false : true,
                        helpText: flag.helpText,
                        name: message.data.toString()
                    }
                });
                break;
            }
            case 'validatePath': {
                if (message.data.toString().trim() === '') {
                    void CreateRouteViewLoader.panel.webview.postMessage({
                        action: 'validatePath',
                        data: {
                            error: false,
                            helpText: '',
                            name: message.data.toString()
                        }
                    });
                    break;
                }
                const flag = validatePath(message.data.toString());
                void CreateRouteViewLoader.panel.webview.postMessage({
                    action: 'validatePath',
                    data: {
                        error: !flag ? false : true,
                        helpText: !flag ? '' : flag,
                        name: message.data.toString()
                    }
                });
                break;
            }
            default:
                void vscode.window.showErrorMessage(`Unrecognized message ${message.command}`);
        }
    }
}





