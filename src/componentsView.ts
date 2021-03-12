/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { pathExistsSync, readFileSync } from 'fs-extra';
import * as path from 'path';
import * as vsc from 'vscode';
import * as jsYaml from 'js-yaml';
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

function isWorkspaceEntry(entry: any): entry is WorkspaceEntry {
    return entry.uri && entry.type;
}

class Labeled {
    constructor(public label: string) {}
}

class Project extends Labeled {
}

class Application extends Labeled {
}

type Entry = Project | Application | WorkspaceEntry | WorkspaceFolderComponent;

export interface WorkspaceFolderComponent {
    project: string;
    application: string;
    contextUri: vsc.Uri;
    label: string;
    description?: string;
    tooltip?: string;
}

function isWorkspaceFolderComponent(entry: any): entry is WorkspaceFolderComponent {
    return entry.contextUri;
}

async function getComponentsInWorkspace(): Promise<WorkspaceFolderComponent[]> {
    const execs: Promise<CliExitData>[] = [];
    if (vsc.workspace.workspaceFolders) {
        vsc.workspace.workspaceFolders.forEach((folder)=> {
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
            let compData: EnvInfo;
            if (result.error) {
                // detect S2I component manually
                const pathToS2iConfig = path.join(result.cwd, '.odo', 'config.yaml');
                if (pathExistsSync(pathToS2iConfig)) {
                    // reconstruct env view form yaml file data
                    const s2iConf = jsYaml.load(readFileSync(pathToS2iConfig, 'utf8'));
                    compData = {
                        spec: {
                            appName: s2iConf.ComponentSettings.Application,
                            project: s2iConf.ComponentSettings.Project,
                            name: s2iConf.ComponentSettings.Name,
                        }
                    }
                }
            } else {
                compData = JSON.parse(result.stdout) as EnvInfo;
            }
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
                contextValue: 'openshift.component'
            }
        } catch (err) {
            // ignore unexpected parsing errors
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
        this.onDidChangeTreeDataEmitter.fire();
    }

    @vsCommand('openshift.componentsView.refresh')
    public static refresh(): void {
        ComponentsTreeDataProvider.instance.refresh();
    }

    @vsCommand('openshift.component.revealInExplorer')
    public static async revealInExplorer(context: Entry): Promise<void> {
        if (isWorkspaceFolderComponent(context)) {
            await vsc.commands.executeCommand('workbench.view.explorer', );
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

    getTreeItem(element: Entry): vsc.TreeItem {
        if (isWorkspaceFolderComponent(element)) {
            return element;
        }
    }

    getChildren(element?: Entry): vsc.ProviderResult<Entry[]> {
        if (element) {
            if (isWorkspaceFolderComponent(element)) {
                return [];
            } else if (isWorkspaceEntry(element)) {
                return []
            }
        }
        return getComponentsInWorkspace();
    }
}