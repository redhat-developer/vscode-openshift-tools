/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as path from 'path';
import { Disposable, Uri, workspace } from 'vscode';
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

    public async getLocalFunctions(): Promise<FunctionObject[]> {
        const functionList: FunctionObject[] = [];
        const folders: Uri[] = [];
        if (workspace.workspaceFolders) {
            for (const wf of workspace.workspaceFolders) {
                const entries = await fs.readdir(wf.uri.fsPath, { withFileTypes: true });
                for (const file of entries) {
                    if (file.isDirectory() && fs.existsSync(path.join(wf.uri.fsPath, file.name, 'func.yaml'))) {
                        folders.push(Uri.file(path.join(wf.uri.fsPath, file.name)));
                    }
                }
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
