/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    TreeDataProvider,
    TreeItem,
    Event,
    EventEmitter,
    Disposable,
    TreeView,
    window,
    extensions,
    version,
    commands,
    Uri,
    TreeItemCollapsibleState,
} from 'vscode';

import * as path from 'path';
import * as k8s from '@kubernetes/client-node';
import { Platform } from './util/platform';

import { WatchUtil, FileContentChangeNotifier } from './util/watch';
import { KubeConfigUtils } from './util/kubeUtils';
import { vsCommand } from './vscommand';
import { KubernetesObject } from '@kubernetes/client-node';
import { CliChannel } from './cli';
import { Command as DeploymentCommand } from './k8s/deployment';
import { DeploymentConfig } from './k8s/deploymentConfig';
import { loadItems } from './k8s/common';

const kubeConfigFolder: string = path.join(Platform.getUserHomePath(), '.kube');

type ExplorerItem = KubernetesObject | k8s.Context;

type PackageJSON = {
  version: string;
  bugs: string;
};

export class OpenShiftExplorer implements TreeDataProvider<ExplorerItem>, Disposable {
    private static instance: OpenShiftExplorer;

    private treeView: TreeView<ExplorerItem>;

    private fsw: FileContentChangeNotifier;
    private kubeContext: k8s.Context;

    private eventEmitter: EventEmitter<ExplorerItem | undefined> =
        new EventEmitter<ExplorerItem | undefined>();

    readonly onDidChangeTreeData: Event<ExplorerItem | undefined> = this
        .eventEmitter.event;

    private constructor() {
        try {
            const ku1 = new KubeConfigUtils();
            this.kubeContext = ku1.getContextObject(ku1.currentContext);
        } catch (err) {
            // ignore config loading error and let odo report it on first call
        }
        try {
            this.fsw = WatchUtil.watchFileForContextChange(kubeConfigFolder, 'config');
        } catch (err) {
            void window.showWarningMessage('Couldn\'t install watcher for Kubernetes configuration file. OpenShift Application Explorer view won\'t be updated automatically.');
        }
        this.fsw?.emitter?.on('file-changed', () => {
            const ku2 = new KubeConfigUtils();
            const newCtx = ku2.getContextObject(ku2.currentContext);
            if (!this.kubeContext
                || (this.kubeContext.cluster !== newCtx.cluster
                    || this.kubeContext.user !== newCtx.user
                    || this.kubeContext.namespace !== newCtx.namespace)) {
                this.refresh();
            }
            this.kubeContext = newCtx;
        });
        this.treeView = window.createTreeView<ExplorerItem>('openshiftProjectExplorer', {
            treeDataProvider: this,
        });
    }

    static getInstance(): OpenShiftExplorer {
        if (!OpenShiftExplorer.instance) {
            OpenShiftExplorer.instance = new OpenShiftExplorer();
        }
        return OpenShiftExplorer.instance;
    }

    // eslint-disable-next-line class-methods-use-this
    getTreeItem(element: ExplorerItem): TreeItem | Thenable<TreeItem> {
        if ('name' in element) { // Context instance
            return  {
                contextValue: 'openshift.k8sContext',
                label: element.name,
                collapsibleState: TreeItemCollapsibleState.Collapsed
            };
        }
        // KubernetesObject instance
        return {
            contextValue: 'openshift.k8sObject',
            label: element.metadata.name,
            collapsibleState: TreeItemCollapsibleState.None,
            iconPath: element.kind === 'Deployment' ? path.resolve(__dirname, '../../images/context/dark/deployment.svg') : path.resolve(__dirname, '../../images/context/dark/deployment-config.svg')
        };
    }

    // eslint-disable-next-line class-methods-use-this
    async getChildren(element?: ExplorerItem): Promise<ExplorerItem[]> {
        const result: ExplorerItem[] = element ? [... await this.getDeployments(), ... await this.getDeploymentConfigs()] : [this.kubeContext];
        if (!element) {
            await commands.executeCommand('setContext', 'openshift.app.explorer.init', result.length === 0);
        }
        return result;
    }

    refresh(target?: ExplorerItem): void {
        this.eventEmitter.fire(target);
    }

    async getDeployments(): Promise<ExplorerItem[]> {
        const deploymentsListData = await CliChannel.getInstance().execute(`${DeploymentCommand.get()}`);
        const result = loadItems<k8s.KubernetesObject>(deploymentsListData.stdout);
        return result;
    }

    async getDeploymentConfigs(): Promise<ExplorerItem[]> {
        const deploymentsListData = await CliChannel.getInstance().execute(`${DeploymentConfig.command.getDeploymentConfigs()}`);
        const result = loadItems<k8s.KubernetesObject>(deploymentsListData.stdout);
        return result;
    }

    dispose(): void {
        this.fsw?.watcher?.close();
        this.treeView.dispose();
    }

    @vsCommand('openshift.resource.load')
    public static loadResource(component: KubernetesObject) {
        void commands.executeCommand('extension.vsKubernetesLoad', {namespace: component.metadata.namespace, kindName: `${component.kind}/${component.metadata.name}`});
    }

    @vsCommand('openshift.resource.openInConsole')
    public static openInConsole(component: KubernetesObject) {
        void commands.executeCommand('extension.vsKubernetesLoad', {namespace: component.metadata.namespace, kindName: `${component.kind}/${component.metadata.name}`});
    }

    @vsCommand('openshift.explorer.reportIssue')
    static async reportIssue(): Promise<unknown> {
        return commands.executeCommand('vscode.open', Uri.parse(OpenShiftExplorer.issueUrl()));
    }

    static issueUrl(): string {
        const packageJSON: PackageJSON = extensions.getExtension('redhat.vscode-openshift-connector')
            .packageJSON as PackageJSON;
        const body = [
            `VS Code version: ${version}`,
            `OS: ${Platform.OS}`,
            `Extension version: ${packageJSON.version}`,
        ].join('\n');
        return `${packageJSON.bugs}/new?labels=kind/bug&title=&body=**Environment**\n${body}\n**Description**`;
    }

}
