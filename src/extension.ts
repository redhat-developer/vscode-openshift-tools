/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    ExtensionContext,
    commands,
    workspace,
    window,
    StatusBarAlignment,
    StatusBarItem,
    env,
    QuickPickItemKind
} from 'vscode';
import path = require('path');
import { startTelemetry } from './telemetry';
import { OpenShiftExplorer } from './explorer';
import { Cluster } from './openshift/cluster';
import { Component } from './openshift/component';
import { Platform } from './util/platform';
import { OdoImpl, ContextType, OdoEvent } from './odo';
import { TokenStore } from './util/credentialManager';
import { registerCommands } from './vscommand';
import { ToolsConfig } from './tools';
import { extendClusterExplorer } from './k8s/clusterExplorer';
import { DebugSessionsView } from './debug';
import { ComponentTypesView } from './registriesView';
import { WelcomePage } from './welcomePage';
import { ComponentsTreeDataProvider } from './componentsView';

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

async function verifyBundledBinaries(): Promise<{ odoPath: string, ocPath: string }> {
    return {
        odoPath: await ToolsConfig.detect('odo'),
        ocPath: await ToolsConfig.detect('oc'),
    };
}

export async function activate(extensionContext: ExtensionContext): Promise<any> {
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
            './openshift/service',
            './k8s/console',
            './oc',
            './registriesView',
            './componentsView',
            './webview/devfile-registry/registryViewLoader'
        )),
        commands.registerCommand('clusters.openshift.useProject', (context) =>
            commands.executeCommand('extension.vsKubernetesUseNamespace', context),
        ),
        crcStatusItem,
        OpenShiftExplorer.getInstance(),
        new DebugSessionsView().createTreeView('openshiftDebugView'),
        ...Component.init(extensionContext),
        ComponentTypesView.instance.createTreeView('openshiftComponentTypesView'),
        ComponentsTreeDataProvider.instance.createTreeView('openshiftComponentsView'),
    ];
    disposable.forEach((value) => extensionContext.subscriptions.push(value));

    function statusBarFunctions() {
        return commands.registerCommand('openshift.openStatusBar', async () => {
            const selection = await window.showQuickPick(
                [
                    {
                        label: '',
                        kind: QuickPickItemKind.Separator
                    },
                    {
                        label:'Add OpenShift Cluster'
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
                        label: 'Create Component from Registries'
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
                    await commands.executeCommand('openshift.component.importFromGit');
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

    function createStatusBarItem(context: ExtensionContext)
    {
        const item = window.createStatusBarItem(StatusBarAlignment.Left, 1);
        item.command = 'openshift.openStatusBar';
        context.subscriptions.push(item);
        context.subscriptions.push(statusBarFunctions());
        item.text = '$(cloud) OpenShift';
        item.show();
    }

    createStatusBarItem(extensionContext) ;

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    OdoImpl.Instance.subject.subscribe(async (event: OdoEvent) => {
        if (event.type === 'inserted' && event.data.contextValue === ContextType.COMPONENT) {
            const choice = await window.showInformationMessage(
                `Do you want to push new '${event.data.getName()}' Component?`,
                'Push',
            );
            if (choice === 'Push') {
                await commands.executeCommand('openshift.component.push', event.data);
            }
        }
    });

    function updateStatusBarItem(statusBarItem: StatusBarItem, text: string): void {
        if (!workspace.getConfiguration('openshiftConnector').get('crcBinaryLocation')) {
            statusBarItem.hide();
            return;
        }
        statusBarItem.text = `$(debug-stop) ${text}`;
        statusBarItem.show();
    }

    updateStatusBarItem(crcStatusItem, 'Stop CRC');
    extendClusterExplorer();

    void ComponentTypesView.instance.getAllComponents();

    startTelemetry(extensionContext);

    return {
        verifyBundledBinaries,
    };
}
