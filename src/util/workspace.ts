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
    label: '$(plus) Add new context folder.',
    description: 'Folder which does not have an OpenShift context',
};

export async function selectWorkspaceFolder(): Promise<Uri> {
    let folder: WorkspaceFolderItem[] = [];
    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
        folder = workspace.workspaceFolders
            .filter((value) => {
                let odoS2iConfigFile = true;
                try {
                    odoS2iConfigFile = !fs
                        .statSync(path.join(value.uri.fsPath, '.odo', 'config.yaml')).isFile();
                } catch (ignore) {
                    // ignore errors if file does not exist
                }
                let odoDevfileEnvFile = true;
                try {
                    odoDevfileEnvFile = !fs
                        .statSync(path.join(value.uri.fsPath, '.odo', 'env', 'env.yaml')).isFile();
                } catch (ignore) {
                    // ignore errors if file does not exist
                }
                return odoS2iConfigFile && odoDevfileEnvFile;
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
                'The folder selected already contains a component. Please select a different folder.',
            );
            return this.selectWorkspaceFolder();
        }
        [workspacePath] = folders;
    } else if (choice) {
        workspacePath = (choice as WorkspaceFolderItem).uri;
    }
    return workspacePath;
}
