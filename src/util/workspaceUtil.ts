import { workspace, QuickPickItem, window, Uri } from "vscode";
import { Platform } from "./platform";
import path = require('path');
import fs = require('fs-extra');

interface WorkspaceFolderItem extends QuickPickItem {
    uri: Uri;
}

class CreateWorkspaceItem implements QuickPickItem {

	constructor() { }

	get label(): string { return `$(plus) Add new context folder.`; }
    get description(): string { return 'Folder which does not have an openshift context'; }

}

export class workspaceUtil {

    static async selectWorkspaceFolder(): Promise<Uri> {
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
        const choice: any = await window.showQuickPick([addWorkspaceFolder, ...folder], {placeHolder: "Select context folder"});
        if (!choice) return null;

        let workspacePath: Uri;

        if (choice === addWorkspaceFolder) {
            const folders = await window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                defaultUri: Uri.file(Platform.getUserHomePath()),
                openLabel: "Add context folder for component in workspace."
            });
            if (!folders) return null;
            if (await this.checkComponentFolder(folders[0])) {
                window.showErrorMessage('The folder selected already contains a component. Please select a different folder');
                return null;
            } else {
                workspacePath = folders[0];
            }
        } else if (choice) {
            workspacePath = choice.uri;
        }
        return workspacePath;
    }

    static async checkComponentFolder(folder) {
        return fs.existsSync(path.join(folder.path, '.odo', 'config.yaml'));
    }
}