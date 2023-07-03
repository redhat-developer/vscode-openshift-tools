/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import {
    Disposable,
    Event,
    EventEmitter,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    TreeView,
    window,
} from 'vscode';

import * as path from 'path';
import { Platform } from '../util/platform';

import { Context, KubernetesObject } from '@kubernetes/client-node';
import { KubeConfigUtils } from '../util/kubeUtils';
import { FileContentChangeNotifier, WatchUtil } from '../util/watch';
import { OpenShiftExplorer } from '../explorer';
import { ServerlessFunction, newInstance } from './serverlessFunctionImpl';
import { FunctionContextType, FunctionObject, FunctionStatus } from './types';
import { vsCommand } from '../vscommand';
import ServerlessFunctionLoader from '../webview/serverless-function/serverlessFunctionLoader';

const kubeConfigFolder: string = path.join(Platform.getUserHomePath(), '.kube');

type ExplorerItem = KubernetesObject | FunctionObject | Context | TreeItem;

export class ServerlessFunctionView implements TreeDataProvider<ExplorerItem>, Disposable {
    private static instance: ServerlessFunctionView;

    private treeView: TreeView<ExplorerItem>;

    private fsw: FileContentChangeNotifier;
    private kubeContext: Context;
    private kubeConfig: KubeConfigUtils;

    private eventEmitter: EventEmitter<ExplorerItem | undefined> =
        new EventEmitter<ExplorerItem | undefined>();

    readonly onDidChangeTreeData: Event<ExplorerItem | undefined> = this
        .eventEmitter.event;

    private serverlessFunction: ServerlessFunction = newInstance();

    private constructor() {
        try {
            this.kubeConfig = new KubeConfigUtils();
            this.kubeContext = this.kubeConfig.getContextObject(this.kubeConfig.currentContext);
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
            this.kubeConfig = ku2;
        });
        this.treeView = window.createTreeView<ExplorerItem>('openshiftServerlessFunctionsView', {
            treeDataProvider: this,
        });
    }

    static getInstance(): ServerlessFunctionView {
        if (!ServerlessFunctionView.instance) {
            ServerlessFunctionView.instance = new ServerlessFunctionView();
        }
        return ServerlessFunctionView.instance;
    }

    getTreeItem(element: ExplorerItem): TreeItem | Thenable<TreeItem> {

        if ('kind' in element) {
            if (element.kind === 'project') {
                return {
                    label: element.metadata.name,
                    collapsibleState: TreeItemCollapsibleState.Collapsed,
                    iconPath: path.resolve(__dirname, '../../../images/context/project-node.png')
                }
            }
        } else if ('context' in element) {
            const functionObj: FunctionObject = element;
            return {
                label: functionObj.name,
                collapsibleState: TreeItemCollapsibleState.None,
                iconPath: path.resolve(__dirname, '../../../images/context/component-node.png'),
                description: this.getDescription(functionObj.context),
                tooltip: this.getTooltip(functionObj),
                contextValue: FunctionContextType.LOCAlFUNCTIONS
            }
        }

    }

    getTooltip(functionObj: FunctionObject): string {
        return `Name: ${functionObj.name}\nRuntime: ${functionObj.runtime}\nTemplate: undefind\nContext: ${functionObj.url}`;
    }

    getDescription(context: string): string {
        return context === FunctionStatus.CLUSTERLOCALBOTH ? 'Local/Cluster' : context === FunctionStatus.LOCALONLY ?
            'Local Only' : context === FunctionStatus.CLUSTERONLY ? 'Cluster Only' : '';
    }

    async getChildren(element?: ExplorerItem): Promise<ExplorerItem[]> {
        let result: ExplorerItem[] = [];
        if (!element) {
            result = await OpenShiftExplorer.getInstance().getProjects();
        } else if ('kind' in element) {
            if (element.kind === 'project') {
                //result = [...await this.serverlessFunction.getDeployedFunctions()]
                result = [...await this.serverlessFunction.getLocalFunctions()]
            }
        }
        return result;
    }

    refresh(target?: ExplorerItem): void {
        this.eventEmitter.fire(target);
    }

    dispose(): void {
        this.fsw?.watcher?.close();
        this.treeView.dispose();
    }

    @vsCommand('openshift.Serverless.createFunction')
    static async openServerlessFunction(): Promise<void> {
        await ServerlessFunctionLoader.loadView('Create Function');
    }
}
