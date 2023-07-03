/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import {
    ExtensionContext,
    QuickPickItemKind,
    StatusBarAlignment,
    StatusBarItem,
    authentication,
    commands,
    env,
    window,
    workspace
} from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { REDHAT_CLOUD_PROVIDER } from './cloudProvider/redhatCloudProvider';
import { ComponentsTreeDataProvider } from './componentsView';
import { DebugSessionsView } from './debug';
import { OpenShiftExplorer } from './explorer';
import { verifyBinariesInRemoteContainer } from './installToolsInRemote';
import { extendClusterExplorer } from './k8s/clusterExplorer';
import { Cluster } from './openshift/cluster';
import { Component } from './openshift/component';
import { ComponentTypesView } from './registriesView';
import { ServerlessFunctionView } from './serveressFunction/serverlessFunctionView';
import { startTelemetry } from './telemetry';
import { ToolsConfig } from './tools';
import { TokenStore } from './util/credentialManager';
import { Platform } from './util/platform';
import { registerCommands } from './vscommand';
import { WelcomePage } from './welcomePage';

import fsx = require('fs-extra');

// eslint-disable-next-line @typescript-eslint/no-empty-function
// this method is called when your extension is deactivated
export function deactivate(): void {
    // intentionally left blank
}

function migrateFromOdo018(): void {
    const newCfgDir = path.join(Platform.getUserHomePath(), '.odo');
    const newCfg = path.join(newCfgDir, 'odo-config.yaml');
    const oldCfg = path.join(Platform.getUserHomePath(), '.kube', 'odo');
    if (!fsx.existsSync(newCfg) && fsx.existsSync(oldCfg)) {
        fsx.ensureDirSync(newCfgDir);
        fsx.copyFileSync(oldCfg, newCfg);
    }
}

async function verifyBundledBinaries(): Promise<{ odoPath: string, ocPath: string, helmPath: string }> {
    return {
        odoPath: await ToolsConfig.detect('odo'),
        ocPath: await ToolsConfig.detect('oc'),
        helmPath: await ToolsConfig.detect('helm'),
    };
}

async function registerKubernetesCloudProvider(): Promise<void> {
    const cloudProvider = await k8s.extension.cloudExplorer.v1;
    if (cloudProvider.available) {
        cloudProvider.api.registerCloudProvider(REDHAT_CLOUD_PROVIDER);
    }
}

export async function activate(extensionContext: ExtensionContext): Promise<unknown> {
    WelcomePage.createOrShow();
    await commands.executeCommand('setContext', 'isVSCode', env.uiKind);
    // UIKind.Desktop ==1 & UIKind.Web ==2. These conditions are checked for browser based & electron based IDE.
    migrateFromOdo018();
    Cluster.extensionContext = extensionContext;
    TokenStore.extensionContext = extensionContext;
    const crcStatusItem = window.createStatusBarItem(StatusBarAlignment.Left);
    crcStatusItem.command = 'openshift.explorer.stopCluster';
    const disposable = [
        ...(await registerCommands(
            './k8s/route',
            './openshift/project',
            './openshift/cluster',
            './k8s/console',
            './oc',
            './registriesView',
            './componentsView',
            './webview/devfile-registry/registryViewLoader',
            './webview/helm-chart/helmChartLoader',
            './feedback'
        )),
        commands.registerCommand('clusters.openshift.useProject', (context) =>
            commands.executeCommand('extension.vsKubernetesUseNamespace', context),
        ),
        crcStatusItem,
        OpenShiftExplorer.getInstance(),
        new DebugSessionsView().createTreeView('openshiftDebugView'),
        ...Component.init(),
        ComponentTypesView.instance.createTreeView('openshiftComponentTypesView'),
        ServerlessFunctionView.getInstance(),
        ComponentsTreeDataProvider.instance.createTreeView('openshiftComponentsView'),
    ];
    disposable.forEach((value) => extensionContext.subscriptions.push(value));

    // activate "Sign in with Red Hat ..."
    void authentication.getSession('redhat-account-auth', ['openid'], { silent: false });

    function statusBarFunctions() {
        return commands.registerCommand('openshift.openStatusBar', async () => {
            const selection = await window.showQuickPick(
                [
                    {
                        label: '',
                        kind: QuickPickItemKind.Separator
                    },
                    {
                        label: 'Add OpenShift Cluster'
                    },
                    {
                        label: 'Login to Cluster'
                    },
                    {
                        label: 'Switch Kubernetes Context',
                    },
                    {
                        label: '',
                        kind: QuickPickItemKind.Separator
                    },
                    {
                        label: 'Create Component from Workspace'
                    },
                    {
                        label: 'Create Component from devfile registry'
                    },
                    {
                        label: 'Import from Git',
                    },
                    {
                        label: '',
                        kind: QuickPickItemKind.Separator
                    },
                    {
                        label: 'Open Welcome Page',
                    },
                    {
                        label: 'Getting Started Walkthrough'
                    }
                ]);
            switch (selection?.label) {
                case 'Add OpenShift Cluster':
                    await commands.executeCommand('openshift.explorer.addCluster');
                    break;
                case 'Login to Cluster':
                    await commands.executeCommand('openshift.explorer.login');
                    break;
                case 'Switch Kubernetes Context':
                    await commands.executeCommand('openshift.explorer.switchContext');
                    break;
                case 'Create Component from Workspace':
                    await commands.executeCommand('openshift.component.createFromLocal');
                    break;
                case 'Create Component from devfile registry':
                    await commands.executeCommand('openshift.componentTypesView.registry.openInView');
                    break;
                case 'Import from Git':
                    await commands.executeCommand('openshift.component.openImportFromGit');
                    break;
                case 'Open Welcome Page':
                    await commands.executeCommand('openshift.welcome');
                    break;
                case 'Getting Started Walkthrough':
                    await commands.executeCommand('openshift.getStarted');
                    break;
                default:
                    break;
            }

        });
    }

    function createStatusBarItem(context: ExtensionContext) {
        const item = window.createStatusBarItem(StatusBarAlignment.Left, 1);
        item.command = 'openshift.openStatusBar';
        context.subscriptions.push(item);
        context.subscriptions.push(statusBarFunctions());
        item.text = '$(cloud) OpenShift';
        item.show();
    }

    createStatusBarItem(extensionContext);

    function updateStatusBarItem(statusBarItem: StatusBarItem, text: string): void {
        if (!workspace.getConfiguration('openshiftToolkit').get('crcBinaryLocation')) {
            statusBarItem.hide();
            return;
        }
        statusBarItem.text = `$(debug-stop) ${text}`;
        statusBarItem.show();
    }

    updateStatusBarItem(crcStatusItem, 'Stop CRC');
    extendClusterExplorer();

    await ComponentTypesView.instance.getAllComponents();

    await registerKubernetesCloudProvider();

    startTelemetry(extensionContext);
    await verifyBinariesInRemoteContainer();

    return {
        verifyBundledBinaries,
    };
}
