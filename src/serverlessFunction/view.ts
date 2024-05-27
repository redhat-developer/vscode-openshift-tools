/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Context, KubernetesObject } from '@kubernetes/client-node';
import * as path from 'path';
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
    commands,
    window,
    workspace
} from 'vscode';
import { vsCommand } from '../vscommand';
import { InvokeServerlessFunctionViewLoader } from '../webview/invoke-serverless-function/invokeServerlessFunctionLoader';
import ServerlessFunctionViewLoader from '../webview/serverless-function/serverlessFunctionLoader';
import ManageRepositoryViewLoader from '../webview/serverless-manage-repository/manageRepositoryLoader';
import { ServerlessFunctionModel } from './functionModel';
import { Functions } from './functions';
import { FunctionContextType, FunctionObject, FunctionSession, FunctionStatus } from './types';

type ExplorerItem = KubernetesObject | FunctionObject | FunctionSession | Context | TreeItem;

export class ServerlessFunctionView implements TreeDataProvider<ExplorerItem>, Disposable {
    private static instance: ServerlessFunctionView;

    private treeView: TreeView<ExplorerItem>;

    private eventEmitter: EventEmitter<ExplorerItem | undefined> =
        new EventEmitter<ExplorerItem | undefined>();

    readonly onDidChangeTreeData: Event<ExplorerItem | undefined> = this
        .eventEmitter.event;

    private serverlessFunction: ServerlessFunctionModel;

    private serverlessFunctionTreeNodes: Map<string, FunctionObject> = new Map();

    private constructor() {
        this.serverlessFunction = new ServerlessFunctionModel(this);
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
                label: functionObj?.name,
                collapsibleState: element.sessions?.length > 0 ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None
            }
            if (functionObj.context !== FunctionStatus.NONE) {
                    explorerItem.iconPath = new ThemeIcon('symbol-function'),
                    explorerItem.description = this.getDescription(functionObj.context),
                    explorerItem.tooltip = this.getTooltip(functionObj),
                    explorerItem.contextValue = this.getContext(functionObj),
                    explorerItem.command = this.getCommand(functionObj);
            }
            return explorerItem;
        } else if ('sessionName' in element) {
            const functionSession: FunctionSession = element;
            const explorerItem: ExplorerItem = {
                label: element.sessionName.substring(0, element.sessionName.indexOf(':')).trim(),
                collapsibleState: TreeItemCollapsibleState.None,
                iconPath: new ThemeIcon('symbol-value'),
            }
            explorerItem.contextValue = 'FunctionSession';
            explorerItem.command = this.getSessionCommand(functionSession)
            return explorerItem;
        }
    }

    getContext(functionObj: FunctionObject): string {
        if (functionObj.hadBuilt || functionObj.hasImage) {
            if (Functions.getInstance().checkRunning(functionObj.folderURI.fsPath)) {
                return FunctionContextType.RUNNING;
            } else if (functionObj.context === FunctionStatus.CLUSTERLOCALBOTH) {
                return FunctionContextType.LOCALDEPLOYFUNCTION
            }
            return FunctionContextType.LOCAlFUNCTIONSWithBuild;
        }
        if (functionObj.context === FunctionStatus.CLUSTERONLY) {
            return FunctionContextType.DEPLOYFUNCTION;
        } else if (functionObj.context === FunctionStatus.CLUSTERLOCALBOTH) {
            return FunctionContextType.LOCALDEPLOYFUNCTION
        }
        return FunctionContextType.LOCAlFUNCTIONS;
    }

    getCommand(functionObj: FunctionObject): Command {
        return { command: 'openshift.Serverless.openFunction', title: 'Open Function', arguments: [functionObj] };
    }

    getSessionCommand(functionSession: FunctionSession): Command {
        return { command: 'openshift.Serverless.showInTerminal', title: 'Show in terminal', arguments: [functionSession] };
    }

    getTooltip(functionObj: FunctionObject): string {
        let text = '';
        if (functionObj.name) {
            text = `Name: ${functionObj.name}\n`;
        }
        if (functionObj.runtime) {
            text += `Runtime: ${functionObj.name}\n`;
        }
        if (functionObj.folderURI) {
            text += `Name: ${functionObj.folderURI.fsPath}\n`;
        }
        return text;
    }

    getDescription(context: string): string {
        return context === `${FunctionStatus.CLUSTERLOCALBOTH}` ?
            'Local/Cluster' : context === `${FunctionStatus.LOCALONLY}` ?
                'Local Only' : context === `${FunctionStatus.CLUSTERONLY}` ? 'Cluster Only' : '';
    }

    async getChildren(element?: ExplorerItem): Promise<ExplorerItem[]> {
        let result: ExplorerItem[] = [];
        if (!element) {
            result = [...await this.serverlessFunction.getLocalFunctions()]
            if (result.length === 0) {
                const functionNode: FunctionObject = {
                    name: 'No Available Functions',
                    context: FunctionStatus.NONE
                }
                result = [functionNode]
            }
        } else if ('sessions' in element && element.sessions.length > 0) {
            result = [...this.processSessions(element)];
        }
        return result;
    }

    refresh(target?: ExplorerItem): void {
        this.eventEmitter.fire(target);
    }

    dispose(): void {
        this.treeView.dispose();
        this.serverlessFunction.dispose();
    }

    @vsCommand('openshift.Serverless.createFunction')
    static async openServerlessFunction(): Promise<void> {
        await ServerlessFunctionViewLoader.loadView('Serverless Function - Create');
    }

    @vsCommand('openshift.Serverless.manageRepository')
    static async openManageRepository(): Promise<void> {
        await ManageRepositoryViewLoader.loadView('Manage Repository');
    }

    @vsCommand('openshift.Serverless.refresh')
    static refresh(target?: ExplorerItem) {
        ServerlessFunctionView.getInstance().refresh(target);
    }

    @vsCommand('openshift.Serverless.baseBuild')
    static async baseBuildFunction(context: FunctionObject) {
        await Functions.getInstance().build(context, false);
    }

    @vsCommand('openshift.Serverless.s2iBuild')
    static async s2iBuildFunction(context: FunctionObject) {
        await Functions.getInstance().build(context, true);
    }

    @vsCommand('openshift.Serverless.onClusterBuild')
    static async onClusterBuild(context: FunctionObject) {
        await Functions.getInstance().onClusterBuild(context);
    }

    @vsCommand('openshift.Serverless.buildAndRun')
    static async buildAndRunFunction(context: FunctionObject) {
        await Functions.getInstance().run(context, true);
    }

    @vsCommand('openshift.Serverless.run')
    static async runFunction(context: FunctionObject) {
        await Functions.getInstance().run(context);
    }

    @vsCommand('openshift.Serverless.stopRun')
    static stopRunFunction(context: FunctionObject) {
        Functions.getInstance().stop(context);
    }

    @vsCommand('openshift.Serverless.deploy')
    static deployFunction(context: FunctionObject) {
        void Functions.getInstance().deploy(context);
    }

    @vsCommand('openshift.Serverless.undeploy')
    static undeployFunction(context: FunctionObject) {
        Functions.getInstance().undeploy(context);
    }

    @vsCommand('openshift.Serverless.invoke')
    static async invokeFunction(context: FunctionObject) {
        await InvokeServerlessFunctionViewLoader.loadView(`${context.name} - Invoke`, context.context, context.folderURI, context.url);
    }

    @vsCommand('openshift.Serverless.openFunction')
    static openFunction(context: FunctionObject) {
        if (!context || !context.folderURI) {
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

    @vsCommand('openshift.Serverless.showInTerminal')
    static async openTerminal(context: FunctionSession) {
        if (!context || context.isDone) {
           return null;
        }
        await commands.executeCommand('openShiftTerminalView.focus');
        context.teminal.focusTerminal();
    }

    @vsCommand('openshift.Serverless.addEnv')
    static async addEnv(context: FunctionObject) {
        await Functions.getInstance().config(`Add environment variables '${context.name}'`, context, 'envs');
    }

    @vsCommand('openshift.Serverless.addLabel')
    static async addLabel(context: FunctionObject) {
        await Functions.getInstance().config(`Add Labels '${context.name}'`, context, 'labels');
    }

    @vsCommand('openshift.Serverless.addVolume')
    static async addVolume(context: FunctionObject) {
        await Functions.getInstance().config(`Add Volumes '${context.name}'`, context, 'volumes');
    }

    @vsCommand('openshift.Serverless.addGit')
    static async addGit(context: FunctionObject) {
        await Functions.getInstance().config(`Add Git '${context.name}'`, context, 'git');
    }

    @vsCommand('openshift.Serverless.removeEnv')
    static removeEnv(context: FunctionObject) {
        void Functions.getInstance().config(`Remove environment variables '${context.name}'`, context, 'envs', false);
    }

    @vsCommand('openshift.Serverless.removeLabel')
    static removeLabel(context: FunctionObject) {
        void Functions.getInstance().config(`Remove Labels '${context.name}'`, context, 'labels', false);
    }

    @vsCommand('openshift.Serverless.removeVolume')
    static async removeVolume(context: FunctionObject) {
        await Functions.getInstance().config(`Remove Volumes '${context.name}'`, context, 'volumes', false);
    }

    @vsCommand('openshift.Serverless.removeGit')
    static async removeGit(context: FunctionObject) {
        await Functions.getInstance().config(`Remove Git '${context.name}'`, context, 'git', false);
    }

    @vsCommand('openshift.Serverless.removeSession')
    static removeSesson(uuid: string ,cwdPath: string, sessionName: string) {
        if (ServerlessFunctionView.getInstance().serverlessFunctionTreeNodes.has(cwdPath)) {
            const element = ServerlessFunctionView.getInstance().serverlessFunctionTreeNodes.get(cwdPath);
            const index = element.sessions.findIndex((session) => session.sessionName === sessionName && session.teminal.id === uuid);
            if(index !== -1) {
                element.sessions.splice(index, 1);
                ServerlessFunctionView.getInstance().refresh(element);
            }
        }
    }

    processSessions(element: FunctionObject): FunctionSession[] {
        const functionSessions: FunctionSession[] = [];
        this.serverlessFunctionTreeNodes.set(element.folderURI.fsPath, element);
        const treeNode = this.serverlessFunctionTreeNodes.get(element.folderURI.fsPath);
        treeNode.sessions.forEach((session: FunctionSession) => {
            functionSessions.push(session);
        });
        return functionSessions;
    }
}
