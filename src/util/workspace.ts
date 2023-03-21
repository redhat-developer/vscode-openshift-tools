/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { workspace, QuickPickItem, window, Uri, WorkspaceFolder } from 'vscode';
import { Platform } from './platform';

import path = require('path');
import fs = require('fs-extra');

interface WorkspaceFolderItem extends QuickPickItem {
    uri: Uri;
}

export const AddWorkspaceFolder: QuickPickItem = {
    label: '$(plus) Select workspace for component',
    description: 'Folder which does not have an OpenShift context',
};

function isFile(path: string) {
    try {
        return fs.statSync(path).isFile()
    } catch (ignore) {
        return false;
    }
}

function isComponent(folder: WorkspaceFolder) {
    return !isFile(path.join(folder.uri.fsPath, 'devfile.yaml'))
        && !isFile(path.join(folder.uri.fsPath, '.devfile.yaml'));
}

function isComponentFilter(wsFolder: WorkspaceFolder) {
    return isComponent(wsFolder);
}

function createWorkspaceFolderItem(wsFolder: WorkspaceFolder) {
    return {
        label: `$(file-directory) ${wsFolder.uri.fsPath}`,
        uri: wsFolder.uri,
    };
}

export async function selectWorkspaceFolder(skipWindowPick = false): Promise<Uri> {
    let folders: WorkspaceFolderItem[] = [];
    let choice:WorkspaceFolderItem | QuickPickItem;
    let workspacePath: Uri;

    if (!skipWindowPick) {
        if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
            folders = workspace.workspaceFolders.filter(isComponentFilter).map(createWorkspaceFolderItem);
        }

        if (folders.length === 1 && workspace.workspaceFolders.length === 1) {
            choice = folders.pop()
        } else {
            choice = await window.showQuickPick(
                [AddWorkspaceFolder, ...folders],
                {placeHolder: 'Select context folder', ignoreFocusOut: true}
            );
        }

        if (!choice) return null;

    }

    if (choice === AddWorkspaceFolder || skipWindowPick) {
        const selectedFolders = await window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: Uri.file(Platform.getUserHomePath()),
            openLabel: skipWindowPick ? 'Select as Repository Destination' : 'Add context folder for component in workspace.',
        });
        if (!selectedFolders) return null;
        if (fs.existsSync(path.join(selectedFolders[0].fsPath, '.odo', 'config.yaml'))) {
            void window.showInformationMessage(
                'The selected folder already contains a component. Please select a different folder.',
            );
            return selectWorkspaceFolder(skipWindowPick);
        }
        [workspacePath] = selectedFolders;
    } else if (choice) {
        workspacePath = (choice as WorkspaceFolderItem).uri;
    }
    return workspacePath;
}
