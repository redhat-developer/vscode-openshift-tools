/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { workspace, QuickPickItem, window, Uri } from 'vscode';
import { Platform } from './platform';

import path = require('path');
import fs = require('fs-extra');

interface WorkspaceFolderItem extends QuickPickItem {
    uri: Uri;
}

export const AddWorkspaceFolder: QuickPickItem = {
    label: `$(plus) Add new context folder.`,
    description: 'Folder which does not have an OpenShift context',
};

export async function selectWorkspaceFolder(): Promise<Uri> {
    let folder: WorkspaceFolderItem[] = [];
    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {

        folder = workspace.workspaceFolders
            .filter((value) => {
                let result = true;
                try {
                    result = !fs
                        .statSync(path.join(value.uri.fsPath, '.odo')).isDirectory();
                } catch (ignore) {
                    // ignore errors if file does not exist
                }
                return result;
            })
            .map((wsFolder) => ({
                label: `$(file-directory) ${wsFolder.uri.fsPath}`,
                uri: wsFolder.uri,
            }));
    }
    const choice = await window.showQuickPick([AddWorkspaceFolder, ...folder], {
        placeHolder: 'Select context folder',
        ignoreFocusOut: true,
    });
    if (!choice) return null;

    let workspacePath: Uri;

    if (choice.label === AddWorkspaceFolder.label) {
        const folders = await window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: Uri.file(Platform.getUserHomePath()),
            openLabel: 'Add context folder for component in workspace.',
        });
        if (!folders) return null;
        if (fs.existsSync(path.join(folders[0].fsPath, '.odo', 'config.yaml'))) {
            window.showInformationMessage(
                'Selected folder already contains a component. Please select a different folder.',
            );
            return this.selectWorkspaceFolder();
        }
        const wsFolder = workspace.getWorkspaceFolder(folders[0]);
        if (wsFolder && wsFolder.uri !== folders[0]) {
            window.showInformationMessage(
                'Selected folder cannot be used, because it is a sub-folder of existing workspace folder.  Please select a different folder.',
            );
            return this.selectWorkspaceFolder();
        }
        [workspacePath] = folders;
    } else if (choice) {
        workspacePath = (choice as WorkspaceFolderItem).uri;
    }
    return workspacePath;
}
