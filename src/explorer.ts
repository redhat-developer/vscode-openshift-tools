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
    private expecingContextUpdate = false;

    private constructor() {
        this.fsw = WatchUtil.watchFileForContextChange(kubeConfigFolder, 'config');
        this.fsw.emitter.on('file-changed', () => {
            if (!this.expecingContextUpdate) {
                this.refresh();
                this.expecingContextUpdate = false;
            }
        });
        this.treeView = window.createTreeView('openshiftProjectExplorer', {
            treeDataProvider: this,
        });
        OpenShiftExplorer.odoctl.subject.subscribe((event) => {
            if (event.type === 'contextIsAboutToChange') {
                this.expecingContextUpdate = true;
            } else if (event.type === 'inserted' && event.data) {
                this.reveal(event.data);
            } else {
                console.log('refresh after subscriber notification', event.data);
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
        console.log('get tree item element', element);
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
        console.log('refresh call', target);
        if (!target) {
            OpenShiftExplorer.odoctl.clearCache();
        }
        this.eventEmitter.fire(target);
    }

    dispose(): void {
        this.fsw.watcher.close();
        this.treeView.dispose();
    }

    async reveal(item: OpenShiftObject): Promise<void> {
        this.refresh(item.getParent());
        await this.treeView.reveal(item);
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
