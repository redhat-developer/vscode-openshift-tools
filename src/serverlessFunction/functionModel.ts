/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as path from 'path';
import { Disposable, Uri, window, workspace } from 'vscode';
import { CommandText } from '../base/command';
import { CliChannel } from '../cli';
import { DeploymentConfig } from '../k8s/deploymentConfig';
import { Utils } from './commands';
import { Functions } from './functions';
import { DeployedFunction, FunctionContent, FunctionObject, FunctionStatus, FunctionView } from './types';

export class ServerlessFunctionModel implements Disposable {

    private watchers: fs.FSWatcher[] = [];
    private workspaceWatcher: Disposable;
    private view: FunctionView;

    public constructor(view: FunctionView) {
        this.view = view;
        this.addWatchers();
        this.workspaceWatcher = workspace.onDidChangeWorkspaceFolders((_e) => {
            for (const watcher of this.watchers) {
                watcher.close();
            }
            this.view.refresh();
            this.addWatchers();
        });
    }

    /**
     * recursivly get the function folders
     * @param filePath directory
     * @param folders list of function folders
     */
    getFunctionsFromDir(filePath: string, folders: Uri[]) {
        const fileContents = fs.readdirSync(filePath, { withFileTypes: true });
        for (const fileContent of fileContents) {
            if (fileContent.isDirectory()) {
                if (fs.existsSync(path.join(filePath, fileContent.name, 'func.yaml'))) {
                    folders.push(Uri.file(path.join(filePath, fileContent.name)));
                }
                this.getFunctionsFromDir(path.join(filePath, fileContent.name), folders);
            }
        }
    }

    public async getLocalFunctions(): Promise<FunctionObject[]> {
        const functionList: FunctionObject[] = [];
        const folders: Uri[] = [];
        if (workspace.workspaceFolders) {
            for (const wf of workspace.workspaceFolders) {
                this.getFunctionsFromDir(wf.uri.fsPath, folders);
                if (fs.existsSync(path.join(wf.uri.fsPath, 'func.yaml'))) {
                    folders.push(wf.uri);
                }
            }
        }
        const deployedFunctions = await this.getDeployedFunctions();
        if (folders.length > 0) {
            for (const folderUri of folders) {
                const funcData: FunctionContent = await Utils.getFuncYamlContent(folderUri.fsPath);
                if (funcData) {
                    const deployFunction: DeployedFunction = this.getDeployFunction(
                        funcData,
                        deployedFunctions,
                    );
                    const functionNode: FunctionObject = {
                        name: funcData.name,
                        runtime: funcData.runtime,
                        folderURI: folderUri,
                        context: deployFunction.status,
                        url: deployFunction.url,
                        hasImage: await this.checkImage(folderUri),
                        isRunning: Functions.getInstance().checkRunning(folderUri.fsPath),
                    };
                    functionList.push(functionNode);
                }
            }
        }
        if (deployedFunctions.length > 0) {
            for (const deployedFunction of deployedFunctions) {
                if (
                    functionList.filter(
                        (functionParam) => functionParam.name === deployedFunction.name,
                    ).length === 0
                ) {
                    const functionNode: FunctionObject = {
                        name: deployedFunction.name,
                        runtime: deployedFunction.runtime,
                        context: FunctionStatus.CLUSTERONLY,
                    };
                    functionList.push(functionNode);
                }
            }
        }
        return functionList;
    }

    public dispose() {
        for (const watcher of this.watchers) {
            watcher.close();
        }
        this.workspaceWatcher.dispose();
    }

    private getDeployFunction(
        funcData: FunctionContent,
        deployedFunctions: FunctionObject[],
    ): DeployedFunction {
        if (deployedFunctions.length > 0) {
            const func = deployedFunctions.find(
                (deployedFunction) =>
                    deployedFunction.name === funcData.name &&
                    deployedFunction.namespace === funcData.deploy?.namespace,
            );
            if (func) {
                return {
                    status: FunctionStatus.CLUSTERLOCALBOTH,
                    url: func.url,
                } as DeployedFunction;
            }
        }
        return { status: FunctionStatus.LOCALONLY, url: '' } as DeployedFunction;
    }

    private async checkImage(folderUri: Uri): Promise<boolean> {
        const yamlContent = await Utils.getFuncYamlContent(folderUri.fsPath);
        return Functions.imageRegex.test(yamlContent?.image);
    }

    private addWatchers() {
        if (workspace.workspaceFolders) {
            for (const workspaceFolder of workspace.workspaceFolders) {
                let folderExists = false;
                try {
                    fs.accessSync(workspaceFolder.uri.fsPath);
                    folderExists = true;
                } catch (e) {
                    // folder doesn't exist
                    void window.showErrorMessage(`Can't keep track of if '${path.basename(workspaceFolder.uri.fsPath)}' contains a serverless function, since it's been deleted.`);
                }
                if (folderExists) {
                    this.watchers.push(
                        fs.watch(workspaceFolder.uri.fsPath, (_event, filename) => {
                            if (filename === 'func.yaml') {
                                this.view.refresh();
                            }
                        }),
                    );
                }
            }
        }
    }

    private async getListItems(command: CommandText, fail = false) {
        const listCliExitData = await CliChannel.getInstance().executeTool(
            command,
            undefined,
            fail,
        );
        try {
            return JSON.parse(listCliExitData.stdout) as FunctionObject[];
        } catch (err) {
            return [];
        }
    }

    private async getDeployedFunctions(): Promise<FunctionObject[]> {
        return this.getListItems(DeploymentConfig.command.getDeploymentFunctions());
    }
}
