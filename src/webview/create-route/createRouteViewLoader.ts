/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import { OpenShiftExplorer } from '../../explorer';
import { Oc } from '../../oc/ocWrapper';
import { ExtensionID } from '../../util/constants';
import { loadWebviewHtml, validateJSONValue, validatePath, validateURL } from '../common-ext/utils';
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
                        protocol: route.port.protocal,
                        targetPort: route.port.targetPort
                    }
                    await Oc.Instance.createRoute(route.routeName, route.serviceName, route.hostname, route.path, port, route.isSecured);
                    void vscode.window.showInformationMessage(`Route ${route.routeName} successfully created.`);
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
            case 'close': {
                CreateRouteViewLoader.panel.dispose();
                CreateRouteViewLoader.panel = undefined;
                break;
            }
            case 'validateRouteName': {
                const flag = validateJSONValue(JSON.stringify(message.data));
                void CreateRouteViewLoader.panel.webview.postMessage({
                    action: 'validateRouteName',
                    data: JSON.stringify({
                        error: !flag ? false : true,
                        helpText: !flag ? '' : flag,
                        name: message.data
                    })
                });
                break;
            }
            case 'validateHost': {
                if (JSON.stringify(message.data).trim() === '') {
                    void CreateRouteViewLoader.panel.webview.postMessage({
                        action: 'validateHost',
                        data: JSON.stringify({
                            error: false,
                            helpText: '',
                            name: message.data
                        })
                    });
                    break;
                }
                const flag = validateURL(message, false);
                void CreateRouteViewLoader.panel.webview.postMessage({
                    action: 'validateHost',
                    data: JSON.stringify({
                        error: !flag.error ? false : true,
                        helpText: flag.helpText,
                        name: message.data
                    })
                });
                break;
            }
            case 'validatePath': {
                if (JSON.stringify(message.data).trim() === '') {
                    void CreateRouteViewLoader.panel.webview.postMessage({
                        action: 'validatePath',
                        data: JSON.stringify({
                            error: false,
                            helpText: '',
                            name: message.data
                        })
                    });
                    break;
                }
                const flag = validatePath(JSON.stringify(message.data));
                void CreateRouteViewLoader.panel.webview.postMessage({
                    action: 'validatePath',
                    data: JSON.stringify({
                        error: !flag ? false : true,
                        helpText: !flag ? '' : flag,
                        name: message.data
                    })
                });
                break;
            }
            default:
                void vscode.window.showErrorMessage(`Unrecognized message ${message.command}`);
        }
    }
}
