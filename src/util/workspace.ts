import { workspace, QuickPickItem, window, Uri } from "vscode";
import { Platform } from "./platform";
import path = require('path');
import fs = require('fs-extra');

interface WorkspaceFolderItem extends QuickPickItem {
    uri: Uri;
}

class CreateWorkspaceItem implements QuickPickItem {

	constructor() { }

	get label(): string { return `$(plus) Add new workspace folder.`; }
    get description(): string { return 'Folder which does not have an openshift context'; }

}

export async function selectWorkspaceFolder(): Promise<Uri> {
    let folder: WorkspaceFolderItem[] = [];
    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
        folder = workspace.workspaceFolders.filter(
            (value) => {
                let result = true;
                try {
                    result = !fs.statSync(path.join(value.uri.fsPath, '.odo', 'config.yaml')).isFile();
                } catch (ignore) {
                }
                return result;
            }
        ).map(
            (folder) => ({ label: `$(file-directory) ${folder.uri.fsPath}`, uri: folder.uri })
        );
    }
    const addWorkspaceFolder = new CreateWorkspaceItem();
    const choice: any = await window.showQuickPick([addWorkspaceFolder, ...folder], {placeHolder: "Select workspace folder"});

    let workspacePath: Uri;

    if (choice === addWorkspaceFolder) {
        const folders = await window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: Uri.file(Platform.getUserHomePath()),
            openLabel: "Add workspace Folder for Component"
        });
        if (!folders) return null;
        workspacePath = folders[0];
    } else if (choice) {
        workspacePath = choice.uri;
    }
    return workspacePath;
}