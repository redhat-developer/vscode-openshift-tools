/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    TreeDataProvider,
    TreeItem,
    Event,
    ProviderResult,
    EventEmitter,
    Disposable,
    TreeView,
    window,
    extensions,
    version,
    commands,
    Uri,
} from 'vscode';

import * as path from 'path';
import { Context } from '@kubernetes/client-node/dist/config_types';
import { Platform } from './util/platform';

import { Odo, OpenShiftObject, OdoImpl } from './odo';
import { WatchUtil, FileContentChangeNotifier } from './util/watch';
import { KubeConfigUtils } from './util/kubeUtils';
import { vsCommand } from './vscommand';

const kubeConfigFolder: string = path.join(Platform.getUserHomePath(), '.kube');

export class OpenShiftExplorer implements TreeDataProvider<OpenShiftObject>, Disposable {
    private static instance: OpenShiftExplorer;

    private static odoctl: Odo = OdoImpl.Instance;

    private treeView: TreeView<OpenShiftObject>;

    private fsw: FileContentChangeNotifier;
    private kubeContext: Context;

    private eventEmitter: EventEmitter<OpenShiftObject | undefined> =
        new EventEmitter<OpenShiftObject | undefined>();

    readonly onDidChangeTreeData: Event<OpenShiftObject | undefined> = this
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
            window.showWarningMessage('Couldn\'t install watcher for Kubernetes configuration file. OpenShift Application Explorer view won\'t be updated automatically.');
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
        this.treeView = window.createTreeView('openshiftProjectExplorer', {
            treeDataProvider: this,
        });
        OpenShiftExplorer.odoctl.subject.subscribe((event) => {
            if (event.reveal) {
                this.reveal(event.data);
            } else {
                this.refresh(event.data);
            }
        });
    }

    static getInstance(): OpenShiftExplorer {
        if (!OpenShiftExplorer.instance) {
            OpenShiftExplorer.instance = new OpenShiftExplorer();
        }
        return OpenShiftExplorer.instance;
    }

    // eslint-disable-next-line class-methods-use-this
    getTreeItem(element: OpenShiftObject): TreeItem | Thenable<TreeItem> {
        return element;
    }

    // eslint-disable-next-line class-methods-use-this
    getChildren(element?: OpenShiftObject): ProviderResult<OpenShiftObject[]> {
        return element ? element.getChildren() : OpenShiftExplorer.odoctl.getClusters();
    }

    // eslint-disable-next-line class-methods-use-this
    getParent?(element: OpenShiftObject): OpenShiftObject {
        return element.getParent();
    }

    refresh(target?: OpenShiftObject): void {
        if (!target) {
            OpenShiftExplorer.odoctl.clearCache();
            commands.executeCommand('openshift.componentTypesView.refresh');
        }
        this.eventEmitter.fire(target);
    }

    dispose(): void {
        this.fsw?.watcher?.close();
        this.treeView.dispose();
    }

    async reveal(item: OpenShiftObject): Promise<void> {
        this.refresh(item.getParent());
        // double call of reveal is workaround for possible upstream issue
        // https://github.com/redhat-developer/vscode-openshift-tools/issues/762
        await this.treeView.reveal(item);
        this.treeView.reveal(item);
    }

    @vsCommand('openshift.explorer.reportIssue')
    static async reportIssue(): Promise<unknown> {
        return commands.executeCommand('vscode.open', Uri.parse(OpenShiftExplorer.issueUrl()));
    }

    static issueUrl(): string {
        const packageJSON = extensions.getExtension('redhat.vscode-openshift-connector')
            .packageJSON;
        const body = [
            `VS Code version: ${version}`,
            `OS: ${Platform.OS}`,
            `Extension version: ${packageJSON.version}`,
        ].join('\n');
        return `${packageJSON.bugs}/new?labels=kind/bug&title=&body=**Environment**\n${body}\n**Description**`;
    }
}
