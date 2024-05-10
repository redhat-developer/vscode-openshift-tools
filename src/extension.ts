/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import {
    authentication,
    commands, env, ExtensionContext, QuickPickItemKind,
    StatusBarAlignment,
    StatusBarItem, window,
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
import { ServerlessFunctionView } from './serverlessFunction/view';
import { startTelemetry } from './telemetry';
import { ToolsConfig } from './tools';
import { TokenStore } from './util/credentialManager';
import { getNamespaceKind, KubeConfigUtils, setKubeConfig } from './util/kubeUtils';
import { Context as KcuContext } from '@kubernetes/client-node/dist/config_types';
import { Platform } from './util/platform';
import { setupWorkspaceDevfileContext } from './util/workspace';
import { registerCommands } from './vscommand';
import { OpenShiftTerminalManager } from './webview/openshift-terminal/openShiftTerminal';
import { WelcomePage } from './welcomePage';
import { registerYamlHandlers } from './yaml/yamlDocumentFeatures';

import fsx = require('fs-extra');
import { Oc } from './oc/ocWrapper';
import { K8S_RESOURCE_SCHEME, K8S_RESOURCE_SCHEME_READONLY, KubernetesResourceVirtualFileSystemProvider } from './k8s/vfs/kuberesources.virtualfs';

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
    void WelcomePage.createOrShow();
    await commands.executeCommand('setContext', 'isVSCode', env.uiKind);
    // UIKind.Desktop ==1 & UIKind.Web ==2. These conditions are checked for browser based & electron based IDE.
    migrateFromOdo018();
    Cluster.extensionContext = extensionContext;
    TokenStore.extensionContext = extensionContext;

    // Temporarily loaded resource providers
    const resourceDocProvider = new KubernetesResourceVirtualFileSystemProvider();

    // Link from resources to referenced resources
    // const resourceLinkProvider = new KubernetesResourceLinkProvider();

    // pick kube config in case multiple are configured
    await setKubeConfig();

    const crcStatusItem = window.createStatusBarItem(StatusBarAlignment.Left);
    crcStatusItem.command = 'openshift.explorer.stopCluster';

    const activeNamespaceStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 1);
    activeNamespaceStatusBarItem.command = 'openshift.project.set';

    const activeContextStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 2);
    activeContextStatusBarItem.command = 'openshift.explorer.switchContext';

    const disposable = [
        ...(await registerCommands(
            './k8s/route',
            './openshift/project',
            './openshift/cluster',
            './openshift/service',
            './k8s/console',
            './yamlFileCommands',
            './registriesView',
            './componentsView',
            './webview/devfile-registry/registryViewLoader',
            './webview/helm-chart/helmChartLoader',
            './webview/helm-manage-repository/manageRepositoryLoader',
            './feedback',
            './deployment'
        )),
        crcStatusItem,
        activeNamespaceStatusBarItem,
        activeContextStatusBarItem,
        OpenShiftExplorer.getInstance(),
        new DebugSessionsView().createTreeView('openshiftDebugView'),
        ...Component.init(),
        ComponentTypesView.instance.createTreeView('openshiftComponentTypesView'),
        ServerlessFunctionView.getInstance(),
        ComponentsTreeDataProvider.instance.createTreeView('openshiftComponentsView'),
        setupWorkspaceDevfileContext(),
        window.registerWebviewViewProvider('openShiftTerminalView', OpenShiftTerminalManager.getInstance(), { webviewOptions: { retainContextWhenHidden: true, } }),
        ...registerYamlHandlers(),
        // Temporarily loaded resource providers
        workspace.registerFileSystemProvider(K8S_RESOURCE_SCHEME, resourceDocProvider, { /* TODO: case sensitive? */ }),
        workspace.registerFileSystemProvider(K8S_RESOURCE_SCHEME_READONLY, resourceDocProvider, { isReadonly: true }),

        // Link from resources to referenced resources
        // languages.registerDocumentLinkProvider({ scheme: K8S_RESOURCE_SCHEME }, resourceLinkProvider),

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
                        label: 'Create Component'
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
                    },
                    {
                        label: 'Getting Started Serverless Function Walkthrough'
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
                case 'Create Component':
                    await commands.executeCommand('openshift.component.openCreateComponent');
                    break;
                case 'Open Welcome Page':
                    await commands.executeCommand('openshift.welcome');
                    break;
                case 'Getting Started Walkthrough':
                    await commands.executeCommand('openshift.getStarted', 'openshiftWalkthrough');
                    break;
                case 'Getting Started Serverless Function Walkthrough':
                    await commands.executeCommand('openshift.getStarted', 'serverlessFunctionWalkthrough');
                    break;
                default:
                    break;
            }

        });
    }

    function createStatusBarItem(context: ExtensionContext) {
        const item = window.createStatusBarItem(StatusBarAlignment.Left, 3);
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

    // Disable the k8s extension displaying its context/namespace status bar items...
    // ...and setup our own context and namespace status bar informer/picker items

    // if true will disable displaying the namespace from the status bar
    function isNamespaceInfoStatusBarDisabled(): boolean {
        // If k8s extension's Namespace Picker is eenabled - do not show the OS Tools's one
        if (workspace.getConfiguration('vs-kubernetes').get('vs-kubernetes.disable-namespace-info-status-bar') === false) {
            return true;
        }

        return workspace.getConfiguration('openshiftToolkit').get['openshiftToolkit.disable-namespace-info-status-bar'];
    }

    // if true will disable displaying the context from the status bar
    function isContextInfoStatusBarDisabled(): boolean {
        // If k8s extension's Namespace Picker is eenabled - do not show the OS Tools's one
        if (workspace.getConfiguration('vs-kubernetes').get('vs-kubernetes.disable-context-info-status-bar') === false) {
            return true;
        }

        return workspace.getConfiguration('openshiftToolkit').get['openshiftToolkit.disable-context-info-status-bar'];
    }

    function updateContextStatusBarItem(statusBarItem: StatusBarItem, iconId: string, text: string, tooltip: string, show: boolean): void {
        statusBarItem.text = `$(${iconId}) ${text}`;
        statusBarItem.tooltip = tooltip;
        if (show && text) {
            statusBarItem.show();
        } else {
            statusBarItem.hide();
        }
    }

    OpenShiftExplorer.getInstance().onDidChangeContextEmitter.event(async (context) => {
        const kind = await getNamespaceKind();
        void Oc.Instance.getActiveProject().then((namespace) =>
            updateContextStatusBarItem(activeNamespaceStatusBarItem, 'project-node', namespace, `Current ${kind}: ${namespace}`,
                !isNamespaceInfoStatusBarDisabled()));

        const kcu: KubeConfigUtils = new KubeConfigUtils();
        const currentContext: KcuContext = kcu.findContext(context);
        updateContextStatusBarItem(activeContextStatusBarItem, 'current-context', currentContext?.name, `${currentContext?.name}\nCluster: ${currentContext?.cluster}`,
            !isContextInfoStatusBarDisabled());
    });

    const kcu: KubeConfigUtils = new KubeConfigUtils();
    const kind = await getNamespaceKind();
    const currentContext: KcuContext = kcu.findContext(kcu.currentContext);
    updateContextStatusBarItem(activeNamespaceStatusBarItem, 'project-node', null, `Current ${kind}`,
        !isNamespaceInfoStatusBarDisabled());
    updateContextStatusBarItem(activeContextStatusBarItem, 'current-context', currentContext?.name, `${currentContext?.name}\nCluster: ${currentContext?.cluster}`,
        !isContextInfoStatusBarDisabled());

    updateStatusBarItem(crcStatusItem, 'Stop CRC');
    void extendClusterExplorer();

    await registerKubernetesCloudProvider();
    void startTelemetry(extensionContext);
    await verifyBinariesInRemoteContainer();

    return {
        verifyBundledBinaries,
    };
}
