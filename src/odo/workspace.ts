/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { EventEmitter, workspace, WorkspaceFolder } from 'vscode';
import * as odo from '../odo';
import { ComponentDescription } from './componentTypeDescription';

export interface ComponentWorkspaceFolder {
    contextPath: string;
    component: ComponentDescription;
}

export interface ComponentsChangeEvent {
    readonly added: ComponentWorkspaceFolder[];
    readonly removed: ComponentWorkspaceFolder[];
}

async function mapFoldersToComponents(folders: readonly WorkspaceFolder[]): Promise<ComponentWorkspaceFolder[]> {
    const descriptions = folders.map(
        (folder) => odo.getInstance().describeComponent(folder.uri.fsPath)
            .then((component: ComponentDescription) => {
                return {
                    contextPath: folder.uri.fsPath,
                    component
                }
            })
    );
    const results = await Promise.all(descriptions);
    return results.filter((compFolder) => !!compFolder.component);
}

export class OdoWorkspace {

    private components: ComponentWorkspaceFolder[];
    private componentsChange = new EventEmitter<ComponentsChangeEvent>();
    private workspaceFoldersChangeProcessed = new EventEmitter<void>();
    public onDidWorkspaceFoldersChangeProcessed = this.workspaceFoldersChangeProcessed.event;

    public get onDidChangeComponents() {
        return this.componentsChange.event;
    }

    constructor() {
        workspace.onDidChangeWorkspaceFolders((event) => {
            let addedPromise: Promise<ComponentWorkspaceFolder[]>;
            const removed = [];
            if(event.added.length>0) {
                // check if added folder has a component
                addedPromise = mapFoldersToComponents(event.added);
            } else {
                addedPromise = Promise.resolve<ComponentWorkspaceFolder[]>([]);
            }
            if(event.removed.length>0) {
                // check if removed folder has a component
                event.removed.forEach((folder) => {
                    const component = this.findComponent(folder);
                    if (component) {
                        removed.push(folder);
                    }
                })
            }
            void addedPromise.then(
                (added) => {
                    if (added.length > 0 || removed.length > 0) {
                        this.componentsChange.fire({
                            added,
                            removed
                        });
                    }
                    this.workspaceFoldersChangeProcessed.fire();
                }
            );
        })
    }

    public reset() {
        this.components = undefined;
    }

    public async getComponents(): Promise<ComponentWorkspaceFolder[]> {
        if (this.components === undefined) {
            await this.loadComponents();
        }
        return this.components;
    }

    private async loadComponents(): Promise<void> {
        if (workspace.workspaceFolders) {
            this.components = await mapFoldersToComponents(workspace.workspaceFolders);
        } else {
            this.components = [];
        }
    }

    public findComponent(folder: WorkspaceFolder) {
        return this.components.find((component) => component.contextPath === folder.uri.fsPath);
    }
}