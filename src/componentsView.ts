/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vsc from 'vscode';
import { BaseTreeDataProvider } from './base/baseTreeDataProvider';
import { CliExitData } from './cli';
import { getInstance } from './odo';
import { Command } from './odo/command';
import { ComponentDescription } from './odo/componentTypeDescription';
import { Component } from './openshift/component';
import { vsCommand } from './vscommand';

export interface WorkspaceEntry {
    uri: vsc.Uri;
    type: vsc.FileType;
}

class Labeled {
    constructor(public label: string) { }
}

class Project extends Labeled {
}

class Application extends Labeled {
}

type Entry = Project | Application | WorkspaceEntry | WorkspaceFolderComponent;

export interface WorkspaceFolderComponent extends vsc.TreeItem {
    contextUri: vsc.Uri;
}

async function getComponentsInWorkspace(): Promise<WorkspaceFolderComponent[]> {
    const execs: Promise<CliExitData>[] = [];
    if (vsc.workspace.workspaceFolders) {
        vsc.workspace.workspaceFolders.forEach((folder) => {
            try {
                execs.push(getInstance().execute(Command.describeComponentJson(), folder.uri.fsPath, false));
            } catch (ignore) {
                // ignore execution errors
            }
        });
    }
    const results = await Promise.all(execs);
    const components: WorkspaceFolderComponent[] = [];
    results.forEach((result) => {
        try {
            if (!result.error) {
                const compData = JSON.parse(result.stdout) as ComponentDescription;
                const isDevMode = compData.runningIn?.includes('Dev') && Component.getComponentDevState(result.cwd);
                const contextUri = vsc.Uri.parse(result.cwd);
                const tooltip = ['Component',
                    `Name: ${compData.devfileData.devfile.metadata.name}`,
                    `Context: ${contextUri.fsPath}`,
                ].join('\n');
                components.push({
                    label: `${compData.devfileData.devfile.metadata.name}${isDevMode ? ' (dev mode)' : ''}`,
                    contextUri,
                    tooltip,
                    contextValue: `openshift.component${isDevMode ? '.devmode' : ''}`,
                    iconPath: vsc.Uri.file(path.join(__dirname, '../../images/component', 'workspace.png'))
                });
            }
        } catch (err) {
            // ignore unexpected parsing and loading errors
        }
    });
    return components;
}

export class ComponentsTreeDataProvider extends BaseTreeDataProvider<Entry> {

    static dataProviderInstance: ComponentsTreeDataProvider;

    private constructor() {
        super();
        vsc.workspace.onDidChangeWorkspaceFolders(() => {
            this.refresh();
        });
        Component.onDidDevStarted(() => this.refresh());
        Component.onDidDevEnded(() => this.refresh());
    }

    private refresh(): void {
        this.onDidChangeTreeDataEmitter.fire(undefined);
    }

    @vsCommand('openshift.componentsView.refresh')
    public static refresh(): void {
        ComponentsTreeDataProvider.instance.refresh();
    }

    @vsCommand('openshift.component.revealInExplorer')
    public static async revealInExplorer(context: WorkspaceFolderComponent): Promise<void> {
        if (context.contextUri) {
            await vsc.commands.executeCommand('workbench.view.explorer',);
            await vsc.commands.executeCommand('revealInExplorer', context.contextUri);
        }
    }

    createTreeView(id: string): vsc.TreeView<Entry> {
        if (!this.treeView) {
            this.treeView = vsc.window.createTreeView(id, {
                treeDataProvider: this,
            });
        }
        return this.treeView;
    }

    static get instance(): ComponentsTreeDataProvider {
        if (!ComponentsTreeDataProvider.dataProviderInstance) {
            ComponentsTreeDataProvider.dataProviderInstance = new ComponentsTreeDataProvider();
        }
        return ComponentsTreeDataProvider.dataProviderInstance;
    }

    getTreeItem(element: WorkspaceFolderComponent): vsc.TreeItem {
        return element;
    }

    getChildren(element?: Entry): vsc.ProviderResult<Entry[]> {
        const result = element ? [] : getComponentsInWorkspace();
        return Promise.resolve(result).then(async result1 => {
            await vsc.commands.executeCommand('setContext', 'openshift.component.explorer.init', result1.length === 0);
            return result;
        })
    }
}
