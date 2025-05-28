/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';
import { promisify } from 'util';
import { ColorTheme, ColorThemeKind, commands, Disposable, extensions, Uri, ViewColumn, WebviewPanel, window } from 'vscode';
import { parse } from 'yaml';
import { OpenShiftExplorer } from '../../explorer';
import * as Helm from '../../helm/helm';
import { Chart, ChartResponse, HelmRepo } from '../../helm/helmChartType';
import sendTelemetry, { ExtCommandTelemetryEvent } from '../../telemetry';
import { ExtensionID } from '../../util/constants';
import { Progress } from '../../util/progress';
import { vsCommand } from '../../vscommand';
import { validateName } from '../common-ext/createComponentHelpers';
import { loadWebviewHtml } from '../common-ext/utils';

let panel: WebviewPanel;
const helmCharts: ChartResponse[] = [];
let themeKind: ColorThemeKind = window.activeColorTheme.kind;

window.onDidChangeActiveColorTheme((editor: ColorTheme) => {
    if (themeKind !== editor.kind) {
        themeKind = editor.kind;
        if (panel) {
            void panel.webview.postMessage({ action: 'setTheme', themeValue: themeKind });
        }
    }
});

export class HelmCommand implements Disposable {
    private static instance: HelmCommand;

    public static getInstance(): HelmCommand {
        if (!HelmCommand.instance) {
            HelmCommand.instance = new HelmCommand();
        }
        return HelmCommand.instance;
    }

    dispose() { }

    @vsCommand('openshift.helm.install')
    static async installHelmChart(event: any) {
        await panel.webview.postMessage({
            action: 'installStatus',
            data: {
                chartName: event.data.chartName,
                message: 'Installing'
            }
        });

        //write temp yaml file for values
        const tmpFolder = Uri.parse(await promisify(tmp.dir)());
        const tempFilePath = path.join(tmpFolder.fsPath, `helmValues-${Date.now()}.yaml`);
        fs.writeFileSync(tempFilePath, event.data.yamlValues, 'utf8');

        void Progress.execFunctionWithProgress(`Installing the chart ${event.data.name}`, async () => {
            await Helm.installHelmChart(event.data.name, event.data.repoName, event.data.chartName, event.data.version, tempFilePath);
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
        }).finally(() => {
            fs.rm(tmpFolder.fsPath, { force: true, recursive: true }, undefined);
        });
    }

    @vsCommand('openshift.helm.open')
    static async openedHelmChart(chartName: any): Promise<void> {
        const openedHelmChart = new ExtCommandTelemetryEvent('openshift.helm.open');
        openedHelmChart.send(chartName);
        return Promise.resolve();
    }
}

async function helmChartMessageListener(event: any): Promise<void> {
    switch (event?.action) {
        case 'init':
            void panel.webview.postMessage({
                action: 'setTheme',
                themeValue: window.activeColorTheme.kind,
            });
            void HelmChartLoader.getHelmCharts();
            break;
        case 'install': {
            void commands.executeCommand('openshift.helm.install', event);
            break;
        }
        case 'openChart': {
            void commands.executeCommand('openshift.helm.open', event.chartName);
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
        case 'getYAMLValues': {
            const yamlValues = await Helm.getYAMLValues(event.data.repoName as string, event.data.chartName as string);
            if (yamlValues) {
                void panel.webview.postMessage({
                    action: 'getYAMLValues',
                    data: {
                        helmChart: event.data,
                        yamlValues: yamlValues.stdout.length > 0 ? yamlValues.stdout : 'noVal'
                    },
                });
            }
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

export default class HelmChartLoader implements Disposable {
    private static instance: HelmChartLoader;

    public static getInstance(): HelmChartLoader {
        if (!HelmChartLoader.instance) {
            HelmChartLoader.instance = new HelmChartLoader();
        }
        return HelmChartLoader.instance;
    }

    dispose() { }

    static get extensionPath() {
        return extensions.getExtension(ExtensionID).extensionPath
    }

    static async loadView(title: string): Promise<WebviewPanel> {
        const localResourceRoot = Uri.file(path.join(HelmChartLoader.extensionPath, 'out', 'helm-chart', 'app'));
        if (panel) {
            // If we already have a panel, show it in the target column
            panel.reveal(ViewColumn.One);
            panel.title = title;
        } else {
            panel = window.createWebviewPanel('helmChartView', title, ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true
            });
            panel.iconPath = Uri.file(path.join(HelmChartLoader.extensionPath, 'images/helm/helm.svg'));
            panel.webview.html = await loadWebviewHtml('helm-chart', panel);
            const messageDisposable = panel.webview.onDidReceiveMessage(helmChartMessageListener);
            panel.onDidDispose(() => {
                messageDisposable.dispose();
                panel = undefined;
            });
        }
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
            await Promise.all(helmRepos.map((helmRepo: HelmRepo) => {
                let url = helmRepo.url;
                url = url.endsWith('/') ? url : url.concat('/');
                url = url.concat('index.yaml');
                return HelmChartLoader.fetchURL(helmRepo, url);
            }));
            void panel?.webview.postMessage(
                {
                    action: 'getHelmCharts',
                    data: {
                        helmCharts
                    }
                }
            );
        }
    }

    private static async fetchURL(repo: HelmRepo, url: string) {
        const helmRepoContent = await fetch(url);
        const yamlResponse = parse(await helmRepoContent.text()) as {
            entries: { [key: string]: Chart[] };
        };
        const entries = yamlResponse.entries;
        Object.keys(entries).forEach((key) => {
            const res: ChartResponse = {
                repoName: repo.name,
                repoURL: repo.url,
                chartName: key,
                chartVersions: entries[key].sort(HelmChartLoader.descOrder),
                displayName: ''
            };
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
