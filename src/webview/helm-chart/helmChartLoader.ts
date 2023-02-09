/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as YAML from 'yaml'
import { ExtensionID } from '../../util/constants';
import { vsCommand } from '../../vscommand';
import { ComponentTypesView } from '../../registriesView';
import { OpenShiftExplorer } from '../../explorer';

let panel: vscode.WebviewPanel;
let entries: any;

async function helmChartMessageListener(event: any): Promise<any> {
    switch (event?.action) {
        case 'install':
            try {
                panel.webview.postMessage({
                    action: 'loadScreen',
                    chartName: event.chartName,
                    show: true
                });
                await ComponentTypesView.instance.installHelmChart(event.name, event.chartName, event.version);
                OpenShiftExplorer.getInstance().refresh();
                panel.webview.postMessage({
                    action: 'loadScreen',
                    show: false,
                    isError: false
                });
            } catch (e) {
                panel.webview.postMessage({
                    action: 'loadScreen',
                    chartName: event.chartName,
                    show: false,
                    isError: true,
                    error: 'Name already exists'
                });
            }
            break;
        default:
            panel.webview.postMessage(
                {
                    error: 'Invalid command'
                }
            );
            break;
    }
}

export default class HelmChartLoader {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    static get extensionPath() {
        return vscode.extensions.getExtension(ExtensionID).extensionPath
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    static async loadView(title: string, url?: string): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(HelmChartLoader.extensionPath, 'out', 'helmChartViewer'));
        if (panel) {
            // If we already have a panel, show it in the target column
            panel.reveal(vscode.ViewColumn.One);
            panel.title = title;
        } else {
            panel = vscode.window.createWebviewPanel('helmChartView', title, vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true
            });
            panel.iconPath = vscode.Uri.file(path.join(HelmChartLoader.extensionPath, 'images/helm/helm.svg'));
            panel.webview.html = HelmChartLoader.getWebviewContent(HelmChartLoader.extensionPath, panel);
            panel.onDidDispose(() => {
                panel = undefined;
            });
            panel.webview.onDidReceiveMessage(helmChartMessageListener);
        }
        getHelmCharts('getHelmCharts');
        return panel;
    }

    private static getWebviewContent(extensionPath: string, p: vscode.WebviewPanel): string {
        // Local path to main script run in the webview
        const reactAppRootOnDisk = path.join(extensionPath, 'out', 'helmChartViewer');
        const reactAppPathOnDisk = vscode.Uri.file(
            path.join(reactAppRootOnDisk, 'helmChartViewer.js'),
        );
        const reactAppUri = p.webview.asWebviewUri(reactAppPathOnDisk);
        const htmlString: Buffer = fs.readFileSync(path.join(reactAppRootOnDisk, 'index.html'));
        const meta = `<meta http-equiv="Content-Security-Policy"
            content="connect-src *;
            default-src 'none';
            img-src ${p.webview.cspSource} https: 'self' data:;
            script-src 'unsafe-eval' 'unsafe-inline' vscode-resource:;
            style-src 'self' vscode-resource: 'unsafe-inline';">`;
        return `${htmlString}`
            .replace('%COMMAND%', '')
            .replace('%PLATFORM%', process.platform)
            .replace('helmChartViewer.js', `${reactAppUri}`)
            .replace('%BASE_URL%', `${reactAppUri}`)
            .replace('<!-- meta http-equiv="Content-Security-Policy" -->', meta);
    }

    @vsCommand('openshift.componentTypesView.registry.openHelmChartsInView')
    public static async openHelmChartInWebview(): Promise<void> {
        await HelmChartLoader.loadView('Helm Charts');
    }

    /*static refresh(): void {
        if (panel) {
            panel.webview.postMessage({ action: 'loadingComponents' });
        }
    }*/
}

async function getHelmCharts(eventName: string): Promise<void> {
    if (!entries) {
        await ComponentTypesView.instance.addHelmRepo();
        const signupResponse = await fetch('https://charts.openshift.io/index.yaml', {
            method: 'GET'
        });
        const yamlResponse = YAML.parse(await signupResponse.text());
        entries = yamlResponse.entries;
    }
    panel?.webview.postMessage(
        {
            action: eventName,
            helmCharts: entries ? entries : undefined,
        }
    );
}

