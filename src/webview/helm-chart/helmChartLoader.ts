/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as JSYAML from 'js-yaml';
import * as path from 'path';
import * as vscode from 'vscode';
import { OpenShiftExplorer } from '../../explorer';
import * as Helm from '../../helm/helm';
import { Chart, ChartResponse, HelmRepo } from '../../helm/helmChartType';
import sendTelemetry, { ExtCommandTelemetryEvent } from '../../telemetry';
import { ExtensionID } from '../../util/constants';
import { Progress } from '../../util/progress';
import { vsCommand } from '../../vscommand';
import { validateName } from '../common-ext/createComponentHelpers';
import { loadWebviewHtml } from '../common-ext/utils';
import fetch = require('make-fetch-happen');

let panel: vscode.WebviewPanel;
const helmCharts: ChartResponse[] = [];
let themeKind: vscode.ColorThemeKind = vscode.window.activeColorTheme.kind;

vscode.window.onDidChangeActiveColorTheme((editor: vscode.ColorTheme) => {
    if (themeKind !== editor.kind) {
        themeKind = editor.kind;
        if (panel) {
            void panel.webview.postMessage({ action: 'setTheme', themeValue: themeKind });
        }
    }
});

export class HelmCommand {
    @vsCommand('openshift.helm.install')
    static async installHelmChart(event: any) {
        await panel.webview.postMessage({
            action: 'installStatus',
            data: {
                chartName: event.data.chartName,
                message: 'Installing'
            }
        });
        void Progress.execFunctionWithProgress(`Installing the chart ${event.data.name}`, async () => {
            await Helm.installHelmChart(event.data.name, event.data.repoName, event.data.chartName, event.data.version);
        }).then(() => {
            void panel.webview.postMessage({
                action: 'installStatus',
                data: {
                    chartName: event.data.chartName,
                    message: 'Installed'
                }
            });
            OpenShiftExplorer.getInstance().refresh();
        }).catch((e) => {
            const message: string = e.message;
            void panel.webview.postMessage({
                action: 'installStatus',
                data: {
                    chartName: event.data.chartName,
                    error: true,
                    message: message.substring(message.indexOf('INSTALLATION FAILED:') + 'INSTALLATION FAILED:'.length)
                }
            });
        });
    }

    @vsCommand('openshift.helm.open')
    static async openedHelmChart(chartName: any): Promise<void> {
        const openedHelmChart = new ExtCommandTelemetryEvent('openshift.helm.open');
        openedHelmChart.send(chartName);
        return Promise.resolve();
    }
}

function helmChartMessageListener(event: any): void {
    switch (event?.action) {
        case 'init':
            void panel.webview.postMessage({
                action: 'setTheme',
                themeValue: vscode.window.activeColorTheme.kind,
            })
            break;
        case 'install': {
            void vscode.commands.executeCommand('openshift.helm.install', event);
            break;
        }
        case 'openChart': {
            void vscode.commands.executeCommand('openshift.helm.open', event.chartName);
            break;
        }
        case 'validateName': {
            const validationMessage = validateName(event.data, false);
            void panel.webview.postMessage({
                action: 'validatedName',
                data: validationMessage,
            });
            break;
        }
        case 'getProviderTypes': {
            const types: string[] = [];
            helmCharts.map((helm: ChartResponse) => {
                if (helm.chartVersions[0].annotations && helm.chartVersions[0].annotations['charts.openshift.io/providerType']) {
                    types.push(helm.chartVersions[0].annotations['charts.openshift.io/providerType']);
                }
            });
            types.sort((regA, regB) => regA.localeCompare(regB));
            void panel.webview.postMessage(
                {
                    action: event.action,
                    data: {
                        types: [... new Set(types)],
                    }
                }
            );
            break;
        }
        /**
         * Send a telemetry message
         */
        case 'sendTelemetry': {
            const actionName: string = event.data.actionName;
            const properties: { [key: string]: string } = event.data.properties;
            void sendTelemetry(actionName, properties);
            break;
        }
        default: {
            void panel.webview.postMessage(
                {
                    error: 'Invalid command'
                }
            );
            break;
        }
    }
}

export default class HelmChartLoader {

    static get extensionPath() {
        return vscode.extensions.getExtension(ExtensionID).extensionPath
    }

    static async loadView(title: string): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(HelmChartLoader.extensionPath, 'out', 'helm-chart', 'app'));
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
            panel.webview.html = await loadWebviewHtml('helm-chart', panel);
            const messageDisposable = panel.webview.onDidReceiveMessage(helmChartMessageListener);
            panel.onDidDispose(() => {
                messageDisposable.dispose();
                panel = undefined;
            });
        }
        await HelmChartLoader.getHelmCharts();
        return panel;
    }

    @vsCommand('openshift.helm.openView')
    public static async openHelmChartInWebview(): Promise<void> {
        await HelmChartLoader.loadView('Helm Charts');
    }

    public static async getHelmCharts(): Promise<void> {
        helmCharts.length = 0;
        const cliData = await Helm.getHelmRepos();
        if (!cliData.error && !cliData.stderr) {
            const helmRepos = JSON.parse(cliData.stdout) as HelmRepo[];
            void panel?.webview.postMessage(
                {
                    action: 'getHelmRepos',
                    data: {
                        helmRepos
                    }
                }
            );
            helmRepos.forEach((helmRepo: HelmRepo) => {
                let url = helmRepo.url;
                url = url.endsWith('/') ? url : url.concat('/');
                url = url.concat('index.yaml');
                void HelmChartLoader.fetchURL(helmRepo, url);
            });
        }
    }

    private static async fetchURL(repo: HelmRepo, url: string) {
        const signupResponse = await fetch(url, {
            method: 'GET'
        });
        const yamlResponse = JSYAML.load(await signupResponse.text()) as any;
        const entries = yamlResponse.entries;
        Object.keys(entries).forEach((key) => {
            const res: ChartResponse = {
                repoName: '',
                repoURL: '',
                chartName: '',
                chartVersions: [],
                displayName: ''
            };
            res.repoName = repo.name;
            res.repoURL = repo.url;
            res.chartName = key;
            res.chartVersions = entries[key].sort(HelmChartLoader.descOrder);
            res.displayName = res.chartVersions[0].annotations ? res.chartVersions[0].annotations['charts.openshift.io/name'] : res.chartVersions[0].name;
            helmCharts.push(res);
        });
        void panel?.webview.postMessage(
            {
                action: 'getHelmCharts',
                data: {
                    helmCharts
                }
            }
        );
    }

    private static descOrder(oldChart: Chart, newChart: Chart): number {
    const oldVersion = parseInt(oldChart.version, 10);
    const newVersion = parseInt(newChart.version, 10);
    return newVersion - oldVersion;
}
}
