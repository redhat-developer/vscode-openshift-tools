/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    Command,
    Disposable,
    Event,
    EventEmitter,
    ThemeIcon,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    TreeView,
    Uri,
    window,
    workspace,
} from 'vscode';

import * as path from 'path';
import { Platform } from '../util/platform';

import { Context, KubernetesObject } from '@kubernetes/client-node';
import { KubeConfigUtils } from '../util/kubeUtils';
import { FileContentChangeNotifier, WatchUtil } from '../util/watch';
import { ServerlessFunction, serverlessInstance } from './functionImpl';
import { FunctionContextType, FunctionObject, FunctionStatus } from './types';
import { vsCommand } from '../vscommand';
import ServerlessFunctionViewLoader from '../webview/serverless-function/serverlessFunctionLoader';

const kubeConfigFolder: string = path.join(Platform.getUserHomePath(), '.kube');

type ExplorerItem = KubernetesObject | FunctionObject | Context | TreeItem;

export class ServerlessFunctionView implements TreeDataProvider<ExplorerItem>, Disposable {
    private static instance: ServerlessFunctionView;

    private treeView: TreeView<ExplorerItem>;

    private fsw: FileContentChangeNotifier;
    private kubeContext: Context;
    private kubeConfig: KubeConfigUtils;
    private currentNameSpace: string;

    private eventEmitter: EventEmitter<ExplorerItem | undefined> =
        new EventEmitter<ExplorerItem | undefined>();

    readonly onDidChangeTreeData: Event<ExplorerItem | undefined> = this
        .eventEmitter.event;

    private serverlessFunction: ServerlessFunction = serverlessInstance();

    private constructor() {
        try {
            this.kubeConfig = new KubeConfigUtils();
            this.kubeContext = this.kubeConfig.getContextObject(this.kubeConfig.currentContext);
        } catch (err) {
            // ignore config loading error
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
                    collapsibleState: TreeItemCollapsibleState.Expanded,
                    iconPath: new ThemeIcon('project')
                }
            }
        } else if ('context' in element) {
            const functionObj: FunctionObject = element;
            const explorerItem: ExplorerItem = {
                label: functionObj.name,
                collapsibleState: TreeItemCollapsibleState.None
            }
            if (functionObj.context !== FunctionStatus.NONE) {
                explorerItem.iconPath = new ThemeIcon('symbol-function'),
                    explorerItem.description = this.getDescription(functionObj.context),
                    explorerItem.tooltip = this.getTooltip(functionObj),
                    explorerItem.contextValue = FunctionContextType.LOCAlFUNCTIONS,
                    explorerItem.command = this.getCommand(functionObj);
            }
            return explorerItem;
        }

    }

    getCommand(functionObj: FunctionObject): Command {
        return { command: 'openshift.Serverless.openFunction', title: 'Open Function', arguments: [functionObj] };
    }

    getTooltip(functionObj: FunctionObject): string {
        return `Name: ${functionObj.name}\nRuntime: ${functionObj.runtime}\nContext: ${functionObj.folderURI.fsPath}`;
    }

    getDescription(context: string): string {
        return context === FunctionStatus.CLUSTERLOCALBOTH ? 'Local/Cluster' : context === FunctionStatus.LOCALONLY ?
            'Local Only' : context === FunctionStatus.CLUSTERONLY ? 'Cluster Only' : '';
    }

    setCurrentNameSpace(value: string) {
        this.currentNameSpace = value;
    }

    public getCurrentNameSpace(): string {
        return this.currentNameSpace;
    }

    async getChildren(element?: ExplorerItem): Promise<ExplorerItem[]> {
        let result: ExplorerItem[] = [];
        if (!element) {
            result = [{
                kind: 'project',
                metadata: {
                    name: this.kubeContext.namespace,
                },
            } as KubernetesObject];
            this.setCurrentNameSpace(this.kubeContext.namespace);
        } else if ('kind' in element) {
            if (element.kind === 'project') {
                result = [...await this.serverlessFunction.getLocalFunctions()]
                if (result.length === 0) {
                    const functionNode: FunctionObject = {
                        name: 'No Available Functions',
                        context: FunctionStatus.NONE
                    }
                    result = [functionNode]
                }
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
        await ServerlessFunctionViewLoader.loadView('Serverless Function - Create');
    }

    @vsCommand('openshift.Serverless.refresh')
    static refresh(target?: ExplorerItem) {
        ServerlessFunctionView.getInstance().refresh(target);
    }

    @vsCommand('openshift.Serverless.build')
    static async buildFunction(context: FunctionObject) {
        await ServerlessFunctionViewLoader.loadView('Serverless Function - Build', context.folderURI, context.name, 1);
    }

    @vsCommand('openshift.Serverless.openFunction')
    static openFunction(context: FunctionObject) {
        if (!context) {
            return null;
        }
        const uriPath = Uri.file(path.join(context.folderURI.fsPath, 'func.yaml'));
        workspace.openTextDocument(uriPath).then(
            (doc) => {
                if (doc) {
                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
                    window.showTextDocument(doc, { preserveFocus: true, preview: true });
                }
            },
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            (err) => window.showErrorMessage(`Error loading document: ${err}`),
        );
    }
}
