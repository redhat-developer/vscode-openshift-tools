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
import { EnvInfo } from './odo/env';
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
    project: string;
    application: string;
    contextUri: vsc.Uri;
}

async function getComponentsInWorkspace(): Promise<WorkspaceFolderComponent[]> {
    const execs: Promise<CliExitData>[] = [];
    if (vsc.workspace.workspaceFolders) {
        vsc.workspace.workspaceFolders.forEach((folder) => {
            try {
                execs.push(getInstance().execute(Command.viewEnv(), folder.uri.fsPath, false));
            } catch (ignore) {
                // ignore execution errors
            }
        });
    }
    const results = await Promise.all(execs);
    return results.map((result) => {
        try {
            if (!result.error) {
                const compData = JSON.parse(result.stdout) as EnvInfo;
                const contextUri = vsc.Uri.parse(result.cwd);
                const project = compData.spec.project ? compData.spec.project : 'N/A';
                const application = compData.spec.appName ? compData.spec.appName : 'N/A';
                const tooltip = ['Component',
                    `Name: ${compData.spec.name}`,
                    `Project: ${project}`,
                    `Application: ${application}`,
                    `Context: ${contextUri.fsPath}`,
                ].join('\n');
                const description = `${project}/${application}`;
                return {
                    project,
                    application,
                    label: compData.spec.name,
                    contextUri,
                    description,
                    tooltip,
                    contextValue: 'openshift.component',
                    iconPath: vsc.Uri.file(path.join(__dirname, '../../images/component', 'workspace.png'))
                };
            }
        } catch (err) {
            // ignore unexpected parsing and loading errors
        }
    });
}

export class ComponentsTreeDataProvider extends BaseTreeDataProvider<Entry> {

    static dataProviderInstance: ComponentsTreeDataProvider;

    private constructor() {
        super();
        vsc.workspace.onDidChangeWorkspaceFolders(() => {
            this.refresh();
        });
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
