/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { workspace } from 'vscode';
import * as odo from '../odo';
import { ComponentDescription } from './componentTypeDescription';

export interface ComponentWorkspaceFolder {
    contextPath: string;
    component: ComponentDescription;
}

export class OdoWorkspace {

    private components: ComponentWorkspaceFolder[];

    constructor() {
        workspace.onDidChangeWorkspaceFolders((event) => {
            if(event.added.length>0) {
                // check if added folder has a component
            }
            if(event.removed.length>0) {
                // check if removed folder has a component
            }
        })
    }

    public async getComponents(): Promise<ComponentWorkspaceFolder[]> {
        if (this.components === undefined) {
            await this.loadComponents();
        }
        return this.components;
    }

    private async loadComponents(): Promise<void> {
        if (workspace.workspaceFolders) {
            const descriptions: Promise<ComponentWorkspaceFolder>[] = workspace.workspaceFolders.map(
                (folder) => odo.getInstance().describeComponent(folder.uri.fsPath)
                    .then((component:ComponentDescription) => {
                        return {
                            contextPath: folder.uri.fsPath,
                            component
                        }
                    }),
            );
            const results = await Promise.all(descriptions);
            this.components = results.filter((compFolder) => !!compFolder.component);
        } else {
            this.components = [];
        }
    }
}