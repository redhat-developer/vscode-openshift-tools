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

export function isFile(pathToFile: string): boolean {
    let result = true;
    try {
        result = !fs.statSync(pathToFile).isFile()
    } catch (ignore) {
        // ignore errors if file does not exist
    }
    return result;
}

export function filterFoldersWithDevfile(folder: string) {
    return !isFile(path.join(folder, 'devfile.yaml')) && !isFile(path.join(folder, '.devfile.yaml'));
}

export async function selectWorkspaceFolder(
    placeHolder = 'Select context folder',
    openFolderLabel = 'Add context folder for component in workspace.',
    openFolderMessage = 'The folder selected already contains a component. Please select a different folder.',
    filter = filterFoldersWithDevfile
    ): Promise<Uri> {
    let folder: WorkspaceFolderItem[] = [];
    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
        folder = workspace.workspaceFolders
            .filter((folderItem)=> filter(folderItem.uri.fsPath))
            .map((wsFolder) => ({
                label: `$(file-directory) ${wsFolder.uri.fsPath}`,
                uri: wsFolder.uri,
            }));
    }
    const choice = await window.showQuickPick([AddWorkspaceFolder, ...folder], {
        placeHolder,
        ignoreFocusOut: true,
    });
    if (!choice) return null;

    let workspacePath: Uri;

    if (choice === AddWorkspaceFolder) {
        const folders = await window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: Uri.file(Platform.getUserHomePath()),
            openLabel: openFolderLabel,
        });
        if (!folders) return null;
        [workspacePath] = folders;
        if (filter(workspacePath.fsPath)) {
            void window.showInformationMessage(
                openFolderMessage
            );
            return selectWorkspaceFolder(placeHolder, openFolderLabel, openFolderMessage, filter);
        }
        if (workspace.getWorkspaceFolder(workspacePath)) {
            void window.showInformationMessage(
                'Selected folder is already in current workspace'
            );
            return selectWorkspaceFolder(placeHolder, openFolderLabel, openFolderMessage, filter);
        }

    } else if (choice) {
        workspacePath = (choice as WorkspaceFolderItem).uri;
    }
    return workspacePath;
}
