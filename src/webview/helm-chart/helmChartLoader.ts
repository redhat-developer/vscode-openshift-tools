/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import * as JSYAML from 'js-yaml';
import { OpenShiftExplorer } from '../../explorer';
import * as Helm from '../../helm/helm';
import sendTelemetry, { ExtCommandTelemetryEvent } from '../../telemetry';
import { ExtensionID } from '../../util/constants';
import { vsCommand } from '../../vscommand';
import { loadWebviewHtml } from '../common-ext/utils';
import { ChartResponse, HelmRepo } from './helmChartType';
import fetch = require('make-fetch-happen');
import { validateName } from '../common-ext/createComponentHelpers';
import { Progress } from '../../util/progress';

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
    @vsCommand('openshift.componentTypesView.registry.helmChart.install')
    static async installHelmChart(event: any) {
        await panel.webview.postMessage({
            action: 'installStatus',
            data: {
                chartName: event.data.chartName,
                message: 'Installing'
            }
        });
        void Progress.execFunctionWithProgress(`Installing the chart ${event.data.name}`, async () => {
            await Helm.installHelmChart(event.data.name, event.data.chartName, event.data.version);
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

    @vsCommand('openshift.componentTypesView.registry.helmChart.open')
    static async openedHelmChart(chartName: any): Promise<void> {
        const openedHelmChart = new ExtCommandTelemetryEvent('openshift.componentTypesView.registry.helmChart.open');
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
            void vscode.commands.executeCommand('openshift.componentTypesView.registry.helmChart.install', event);
            break;
        }
        case 'openChart': {
            void vscode.commands.executeCommand('openshift.componentTypesView.registry.helmChart.open', event.chartName);
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
        await getHelmCharts();
        return panel;
    }

    @vsCommand('openshift.componentTypesView.registry.openHelmChartsInView')
    public static async openHelmChartInWebview(): Promise<void> {
        await HelmChartLoader.loadView('Helm Charts');
    }
}

async function getHelmCharts(): Promise<void> {
    if (helmCharts.length === 0) {
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
                void fetchURL(helmRepo, url);
            });
        }
    }
}

async function fetchURL(repo: HelmRepo, url: string) {
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
        res.chartVersions = entries[key].reverse();
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
