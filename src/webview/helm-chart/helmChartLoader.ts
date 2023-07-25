/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import * as YAML from 'yaml';
import { OpenShiftExplorer } from '../../explorer';
import * as Helm from '../../helm/helm';
import { ExtCommandTelemetryEvent } from '../../telemetry';
import { ExtensionID } from '../../util/constants';
import { vsCommand } from '../../vscommand';
import { loadWebviewHtml } from '../common-ext/utils';
import { ChartResponse } from './helmChartType';
import fetch = require('make-fetch-happen');

let panel: vscode.WebviewPanel;
let helmRes: ChartResponse[] = [];
let themeKind: vscode.ColorThemeKind = vscode.window.activeColorTheme.kind;

vscode.window.onDidChangeActiveColorTheme((editor: vscode.ColorTheme) => {
    if (themeKind !== editor.kind) {
        themeKind = editor.kind;
        if (panel) {
            panel.webview.postMessage({ action: 'setTheme', themeValue: themeKind });
        }
    }
});

export class HelmCommand {
    @vsCommand('openshift.componentTypesView.registry.helmChart.install')
    static async installHelmChart(event: any) {
        try {
            panel.webview.postMessage({
                action: 'loadScreen',
                chartName: event.chartName,
                show: true
            });
            await Helm.installHelmChart(event.name, event.chartName, event.version);
            vscode.window.showInformationMessage(`Helm Chart: ${event.name} is successfully installed and will be reflected in the tree view.`);
            OpenShiftExplorer.getInstance().refresh();
            panel.webview.postMessage({
                action: 'loadScreen',
                show: false,
                isError: false,
                isInstalled: true
            });
        } catch (e) {
            vscode.window.showErrorMessage(`Installation failed: ${e.message.substring(e.message.indexOf('INSTALLATION FAILED:') + 'INSTALLATION FAILED:'.length)}`);
            panel.webview.postMessage({
                action: 'loadScreen',
                chartName: event.chartName,
                show: false,
                isError: true,
                error: 'Name already exists'
            });
        }
    }

    @vsCommand('openshift.componentTypesView.registry.helmChart.open')
    static async openedHelmChart(chartName: any) {
        const openedHelmChart = new ExtCommandTelemetryEvent('openshift.componentTypesView.registry.helmChart.open');
        openedHelmChart.send(chartName);
    }
}

async function helmChartMessageListener(event: any): Promise<any> {
    switch (event?.action) {
        case 'install':
            vscode.commands.executeCommand('openshift.componentTypesView.registry.helmChart.install', event);
            break;
        case 'openChart':
            vscode.commands.executeCommand('openshift.componentTypesView.registry.helmChart.open', event.chartName);
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
            panel.webview.html = await loadWebviewHtml('helmChartViewer', panel);
            panel.onDidDispose(() => {
                panel = undefined;
            });
            panel.webview.onDidReceiveMessage(helmChartMessageListener);
        }
        getHelmCharts('getHelmCharts');
        return panel;
    }

    @vsCommand('openshift.componentTypesView.registry.openHelmChartsInView')
    public static async openHelmChartInWebview(): Promise<void> {
        await HelmChartLoader.loadView('Helm Charts');
    }
}

async function getHelmCharts(eventName: string): Promise<void> {
    if (helmRes.length === 0) {
        await Helm.addHelmRepo();
        await Helm.updateHelmRepo();
        const signupResponse = await fetch('https://charts.openshift.io/index.yaml', {
            method: 'GET'
        });
        const yamlResponse = YAML.parse(await signupResponse.text());
        const entries = yamlResponse.entries;
        Object.keys(entries).forEach((key) => {
            let res: ChartResponse = {
                chartName: '',
                chartVersions: [],
                displayName: ''
            }
            res.chartName = key;
            res.chartVersions = entries[key];
            res.displayName = res.chartVersions[0].annotations['charts.openshift.io/name'] || res.chartVersions[0].name;
            helmRes.push(res);
        })
    }
    panel?.webview.postMessage(
        {
            action: eventName,
            helmRes: helmRes,
            themeValue: themeKind,
        }
    );
}

