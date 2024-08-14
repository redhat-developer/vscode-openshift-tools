/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as path from 'path';
import { commands, Disposable, QuickPickItem, Uri, window, workspace, WorkspaceFolder } from 'vscode';
import { Platform } from './platform';

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
    } catch {
        return false;
    }
}

function isComponentorFunction(folder: WorkspaceFolder) {
    return !isFile(path.join(folder.uri.fsPath, 'devfile.yaml'))
        && !isFile(path.join(folder.uri.fsPath, '.devfile.yaml'))
        && !isFile(path.join(folder.uri.fsPath, 'func.yaml'));
}

function componentAndFuctionFilter(wsFolder: WorkspaceFolder) {
    return isComponentorFunction(wsFolder);
}

function createWorkspaceFolderItem(wsFolder: WorkspaceFolder) {
    return {
        label: `$(file-directory) ${wsFolder.uri.fsPath}`,
        uri: wsFolder.uri,
    };
}

export function selectWorkspaceFolders(): Uri[] {
    const workspacePaths: Uri[] = [];
    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
        workspace.workspaceFolders.filter(componentAndFuctionFilter).map(createWorkspaceFolderItem).map((workSpaceItem) => workspacePaths.push(workSpaceItem.uri));
    }
    return workspacePaths;
}

export async function selectWorkspaceFolder(skipWindowPick = false, label?: string, folderName?: string, initialFolder?: string): Promise<Uri> {
    let folders: WorkspaceFolderItem[] = [];
    let choice:WorkspaceFolderItem | QuickPickItem;
    let workspacePath: Uri;

    if (!skipWindowPick) {
        if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
            folders = workspace.workspaceFolders.filter(componentAndFuctionFilter).map(createWorkspaceFolderItem);
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
            defaultUri: Uri.file(initialFolder ? initialFolder : Platform.getUserHomePath()),
            openLabel: label || 'Add context folder for component in workspace.',
        });
        if (!selectedFolders) return null;
        if (fs.existsSync(path.join(selectedFolders[0].fsPath, '.odo', 'config.yaml'))) {
            void window.showInformationMessage(
                'The selected folder already contains a component. Please select a different folder.',
            );
            return selectWorkspaceFolder(skipWindowPick, label, folderName, initialFolder);
        } else if(folderName && fs.existsSync(path.join(selectedFolders[0].fsPath, folderName))) {
            void window.showInformationMessage(
                `The folder ${folderName} already exists. Please select a different folder.`,
            );
            return selectWorkspaceFolder(skipWindowPick, label, folderName, initialFolder);
        }
        [workspacePath] = selectedFolders;
    } else if (choice) {
        workspacePath = (choice as WorkspaceFolderItem).uri;
    }
    return workspacePath;
}

export function getInitialWorkspaceFolder(): string | undefined {
    const wsFolders: path.ParsedPath[] = [];
    if (workspace.rootPath) {
        wsFolders.push(path.parse(workspace.rootPath));
    }
    workspace?.workspaceFolders?.forEach((f) => wsFolders.push(path.parse(f.uri.fsPath)));

    if (wsFolders.length > 0) {
        const fsRoot = wsFolders[0].root;
        let prefix = path.join(wsFolders[0].dir, wsFolders[0].name);
        while(fsRoot !== prefix ) {
            const count = wsFolders.filter((f) => {
                    try {
                        const diff = path.relative(prefix, path.join(f.dir, f.name));
                        return diff.length >= 0 && !diff.startsWith('..');
                    } catch {
                        return false;
                    }
                }).length;
            if(wsFolders.length === count) {
                return prefix;
            }
            prefix = path.parse(prefix).dir;
       }
    }
    return undefined;
}

/**
 * Update `ext.folderContainsDevfile` according to the opened folders and devfiles
 *
 * @param _ ignored
 */
async function updateDevfileContext(_: unknown) {
    const folders = workspace.workspaceFolders ? workspace.workspaceFolders : [];
    const devfileFolders: WorkspaceFolder[] = [];
    await Promise.all(
        folders.map(async (folder) => {
            const devfilePath = path.join(folder.uri.fsPath, 'devfile.yaml');
            if (await fs.pathExists(devfilePath)) {
                devfileFolders.push(folder);
            }
        }),
    );
    const foldersArray = devfileFolders.map(folder => folder.name);
    void commands.executeCommand('setContext', 'ext.folderContainsDevfile', foldersArray)
        .then(() => void commands.executeCommand('openshift.componentsView.refresh'));
}

/**
 * Sets up the context `ext.folderContainsDevfile` for use in package.json.
 *
 * Updates the context when folders are added to the workspace or devfiles are created/deleted.
 *
 * @returns a disposable to dispose of the watcher
 */
export function setupWorkspaceDevfileContext(): Disposable {
    void updateDevfileContext(undefined);
    const devfileWatcher = workspace.createFileSystemWatcher('**/{devfile,.devfile}.yaml');
    devfileWatcher.onDidCreate(updateDevfileContext);
    devfileWatcher.onDidDelete(updateDevfileContext);
    workspace.onDidChangeWorkspaceFolders(updateDevfileContext);
    return devfileWatcher;
}
