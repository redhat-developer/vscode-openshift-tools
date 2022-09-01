/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    ExtensionContext,
    commands,
    workspace,
    window,
    WorkspaceFoldersChangeEvent,
    StatusBarAlignment,
    StatusBarItem,
    env
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
import { WatchSessionsView } from './watch';
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
            './openshift/catalog',
            './openshift/project',
            './openshift/application',
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
        commands.registerCommand('openshift.component.deployRootWorkspaceFolder', Component.deployRootWorkspaceFolder),
        crcStatusItem,
        OpenShiftExplorer.getInstance(),
        new WatchSessionsView().createTreeView('openshiftWatchView'),
        new DebugSessionsView().createTreeView('openshiftDebugView'),
        ...Component.init(extensionContext),
        ComponentTypesView.instance.createTreeView('openshiftComponentTypesView'),
        ComponentsTreeDataProvider.instance.createTreeView('openshiftComponentsView'),
    ];
    disposable.forEach((value) => extensionContext.subscriptions.push(value));

    // TODO: Implement the case when 'odo watch' is running for component and push would be done automatically
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    OdoImpl.Instance.subject.subscribe(async (event: OdoEvent) => {
        if (event.type === 'inserted' && event.data.contextValue === ContextType.COMPONENT) {
            const choice = await window.showInformationMessage(
                `Do you want to push new '${event.data.getName()}' Component?`,
                'Push',
            );
            if (choice === 'Push') {
                await commands.executeCommand('openshift.component.push', event.data);
                OpenShiftExplorer.getInstance().refresh(event.data);
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

    workspace.onDidChangeWorkspaceFolders((event: WorkspaceFoldersChangeEvent) => {
        OdoImpl.Instance.loadWorkspaceComponents(event);
    });

    void ComponentTypesView.instance.getAllComponents();

    OdoImpl.Instance.loadWorkspaceComponents(null);

    startTelemetry(extensionContext);

    return {
        verifyBundledBinaries,
    };
}
