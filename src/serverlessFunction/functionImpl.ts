/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Disposable, Uri, window, workspace } from 'vscode';
import { dump } from 'js-yaml';
import { CommandText } from '../base/command';
import { CliChannel, CliExitData } from '../cli';
import { DeploymentConfig } from '../k8s/deploymentConfig';
import { OdoImpl } from '../odo';
import { VsCommandError } from '../vscommand';
import { ServerlessCommand, Utils } from './commands';
import { Functions } from './functions';
import { DeployedFunction, FunctionContent, FunctionObject, FunctionStatus } from './types';
import { ServerlessFunctionView } from './view';

export interface ServerlessFunction extends Disposable {
    getLocalFunctions(): Promise<FunctionObject[]>;
    createFunction(language: string, template: string, location: string, image: string): Promise<CliExitData>;
}

export class ServerlessFunctionImpl implements ServerlessFunction {
    private static instance: ServerlessFunction = new ServerlessFunctionImpl();

    private watchers: fs.FSWatcher[] = [];
    private workspaceWatcher: Disposable;

    public static get Instance(): ServerlessFunction {
        return ServerlessFunctionImpl.instance;
    }

    private constructor() {
        this.addWatchers();
        this.workspaceWatcher = workspace.onDidChangeWorkspaceFolders((_e) => {
            for (const watcher of this.watchers) {
                watcher.close();
            }
            ServerlessFunctionView.getInstance().refresh();
            this.addWatchers();
        });
    }

    private addWatchers() {
        if (workspace.workspaceFolders) {
            for (const workspaceFolder of workspace.workspaceFolders) {
                this.watchers.push(
                    fs.watch(workspaceFolder.uri.fsPath, (_event, filename) => {
                        if (filename === 'func.yaml') {
                            ServerlessFunctionView.getInstance().refresh();
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

    async createFunction(
        language: string,
        template: string,
        location: string,
        image: string,
    ): Promise<CliExitData> {
        let functionResponse: CliExitData;
        try {
            const response = await OdoImpl.Instance.execute(
                ServerlessCommand.createFunction(language, template, location),
            );
            if (response && !response.error) {
                const yamlContent = await Utils.getFuncYamlContent(location);
                if (yamlContent) {
                    yamlContent.image = image;
                    await fs.rm(path.join(location, 'func.yaml'));
                    await fs.writeFile(
                        path.join(location, 'func.yaml'),
                        dump(yamlContent),
                        'utf-8',
                    );
                    functionResponse = {
                        error: undefined,
                        stderr: '',
                        stdout: 'Success',
                    };
                }
            } else {
                await fs.rmdir(location);
                functionResponse = response;
            }
        } catch (err) {
            if (err instanceof VsCommandError) {
                void window.showErrorMessage(err.message);
            }
            await fs.rmdir(location);
            functionResponse = {
                error: err as cp.ExecException,
                stderr: '',
                stdout: '',
            };
        }
        return functionResponse;
    }

    async getLocalFunctions(): Promise<FunctionObject[]> {
        const functionList: FunctionObject[] = [];
        const folders: Uri[] = [];
        if (workspace.workspaceFolders) {
            for (const wf of workspace.workspaceFolders) {
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

    getDeployFunction(
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

    dispose() {
        for (const watcher of this.watchers) {
            watcher.close();
        }
        this.workspaceWatcher.dispose();
    }

    async checkImage(folderUri: Uri): Promise<boolean> {
        const yamlContent = await Utils.getFuncYamlContent(folderUri.fsPath);
        return Functions.imageRegex.test(yamlContent?.image);
    }
}

export function serverlessInstance(): ServerlessFunction {
    return ServerlessFunctionImpl.Instance;
}
