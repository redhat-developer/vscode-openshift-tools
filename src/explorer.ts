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
import { Platform } from './util/platform';

import { WatchUtil, FileContentChangeNotifier } from './util/watch';
import { KubeConfigUtils } from './util/kubeUtils';
import { vsCommand } from './vscommand';
import { KubernetesObject, Context } from '@kubernetes/client-node';
import { CliChannel } from './cli';
import { Command } from './odo/command';
import { newInstance, Odo3 } from './odo3';
import { getInstance } from './odo';

const kubeConfigFolder: string = path.join(Platform.getUserHomePath(), '.kube');

type ExplorerItem = KubernetesObject | Context | TreeItem;

type PackageJSON = {
  version: string;
  bugs: string;
};

const CREATE_OR_SET_PROJECT_ITEM = {
    label: 'Create new or set active Project',
    command: {
        title: 'Create new or ser active Project',
        command: 'openshift.project.set'
    }
};

export class OpenShiftExplorer implements TreeDataProvider<ExplorerItem>, Disposable {
    private static instance: OpenShiftExplorer;

    private treeView: TreeView<ExplorerItem>;

    private fsw: FileContentChangeNotifier;
    private kubeContext: Context;
    private kubeConfig: KubeConfigUtils;

    private eventEmitter: EventEmitter<ExplorerItem | undefined> =
        new EventEmitter<ExplorerItem | undefined>();

    readonly onDidChangeTreeData: Event<ExplorerItem | undefined> = this
        .eventEmitter.event;

    private odo3: Odo3 = newInstance();

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
        this.treeView = window.createTreeView<ExplorerItem>('openshiftProjectExplorer', {
            treeDataProvider: this,
        });
    }

    async getCurrentClusterUrl(): Promise<string | undefined> {
        // print odo version and Server URL if user is logged in
        const result = await CliChannel.getInstance().executeTool(Command.printOdoVersion());
        // search for line with 'Server:' substring
        const clusterLine = result.stdout.trim().split('\n').find((value) => value.includes('Server:'));
        // if line with Server: is printed out it means user is logged in
        void commands.executeCommand('setContext', 'isLoggedIn', !!clusterLine);
        // cut out server url after 'Server:' substring
        return clusterLine ? clusterLine.substring(clusterLine.indexOf(':') + 1).trim() : undefined;
    }

    static getInstance(): OpenShiftExplorer {
        if (!OpenShiftExplorer.instance) {
            OpenShiftExplorer.instance = new OpenShiftExplorer();
        }
        return OpenShiftExplorer.instance;
    }

    // eslint-disable-next-line class-methods-use-this
    getTreeItem(element: ExplorerItem): TreeItem | Thenable<TreeItem> {

        if ('command' in element) {
            return element;
        }

        // check if element is Context instance
        if ('name' in element && 'cluster' in element && 'user' in element) { // Context instance could be without namespace
            return  {
                contextValue: 'openshift.k8sContext',
                label: this.kubeConfig.getCluster(element.cluster).server,
                collapsibleState: TreeItemCollapsibleState.Collapsed,
                iconPath: path.resolve(__dirname, '../../images/context/cluster-node.png')
            };
        }

        // otherwise it is a KubernetesObject instance

        if ('kind' in element) {
            if (element.kind === 'project') {
                return {
                    contextValue: 'openshift.project',
                    label: element.metadata.name,
                    collapsibleState: TreeItemCollapsibleState.Collapsed,
                    iconPath: path.resolve(__dirname, '../../images/context/project-node.png')
                }
            }
            return {
                contextValue: 'openshift.k8sObject',
                label: element.metadata.name,
                collapsibleState: TreeItemCollapsibleState.None,
                iconPath: {
                    dark: path.resolve(__dirname, '../../images/context/component-node-dark.png'),
                    light: path.resolve(__dirname, '../../images/context/component-node-light.png')
                }
            };
        }

        return {
            label: 'Unknown element'
        }
    }

    // eslint-disable-next-line class-methods-use-this
    async getChildren(element?: ExplorerItem): Promise<ExplorerItem[]> {
        let result: ExplorerItem[] = [];
        if (!element) {
            try {
                await this.odo3.getNamespaces()
                result = [this.kubeContext];
            } catch (err) {
                // ignore because ether server is not accessible or user is logged out
            }
        } else if ('name' in element) { // we are dealing with context here
            // user is logged into cluster from current context
            // and project should be show as child node of current context
            // there are several possible scenarios
            // (1) there is no namespace set in context and default namespace/project exists
            //   * example is kubernetes provisioned with docker-desktop
            //   * could also be the case with CRC provisioned for the first time
            // (2) there is no namespace set in context and default namespace/project does not exist
            //   * example is sandbox context created when login to sandbox first time
            // (3) there is namespace set in context and namespace exists in the cluster
            // (4) there is namespace set in context and namespace does not exist in the cluster
            const pOrNs = await this.odo3.getNamespaces();
            if (this.kubeContext.namespace) {
                if (pOrNs.find(item => item?.metadata.name === this.kubeContext.namespace)) {
                    result = [{
                        kind: 'project',
                        metadata: {
                            name: this.kubeContext.namespace,
                        },
                    } as KubernetesObject]
                } else {
                    result = [CREATE_OR_SET_PROJECT_ITEM]
                }
            } else {
                // get list of projects or namespaces
                // find default namespace
                if (pOrNs.find(item => item?.metadata.name === 'default')) {
                    result = [{
                        kind: 'project',
                        metadata: {
                            name: 'default',
                        },
                    } as KubernetesObject]
                } else {
                    result = [CREATE_OR_SET_PROJECT_ITEM]
                }
            }
        } else {
            result = [...await this.odo3.getDeploymentConfigs(), ...await this.odo3.getDeployments()];
        }

        if (!element) {
            await commands.executeCommand('setContext', 'openshift.app.explorer.init', result.length === 0);
        }
        return result;
    }

    refresh(target?: ExplorerItem): void {
        this.eventEmitter.fire(target);
        getInstance().clearCache();
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
