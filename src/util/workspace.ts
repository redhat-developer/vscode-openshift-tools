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
    label: '$(plus) Select workspace for component',
    description: 'Folder which does not have an OpenShift context',
};

export async function selectWorkspaceFolder(): Promise<Uri> {
    let folder: WorkspaceFolderItem[] = [];
    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
        folder = workspace.workspaceFolders
            .filter((value) => {
                let emptyWSFolder = false;
                try {
                    emptyWSFolder = fs.readdirSync(value.uri.fsPath).length === 0;
                } catch (ignore) {
                    // ignore errors if file does not exist
                }
                if (!emptyWSFolder) {
                    let odoDevfile = true;
                    try {
                        odoDevfile = !fs.statSync(path.join(value.uri.fsPath, 'devfile.yaml')).isFile()
                    } catch (ignore) {
                        // ignore errors if file does not exist
                    }
                    let odoDotDevfile = true;
                    try {
                        odoDotDevfile = !fs.statSync(path.join(value.uri.fsPath, '.devfile.yaml')).isFile();
                    } catch (ignore) {
                        // ignore errors if file does not exist
                    }
                    // if there is no devfile.yaml and no .devfile.yaml in the root of workspace folder
                    return !odoDevfile && !odoDotDevfile;
                }
                return emptyWSFolder;
            })
            .map((wsFolder) => ({
                label: `$(file-directory) ${wsFolder.uri.fsPath}`,
                uri: wsFolder.uri,
            }));
    }
    const choice = folder?.length === 1 ? folder.pop() : await window.showQuickPick([AddWorkspaceFolder, ...folder], {
        placeHolder: 'Select context folder',
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
            openLabel: 'Add context folder for component in workspace.',
        });
        if (!folders) return null;
        if (fs.existsSync(path.join(folders[0].fsPath, '.odo', 'config.yaml'))) {
            window.showInformationMessage(
                'The folder selected already contains a component. Please select a different folder.',
            );
            return selectWorkspaceFolder();
        }
        [workspacePath] = folders;
    } else if (choice) {
        workspacePath = (choice as WorkspaceFolderItem).uri;
    }
    return workspacePath;
}
