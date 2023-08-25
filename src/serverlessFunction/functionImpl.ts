/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as fs from 'fs-extra';
import { Uri, window, workspace } from 'vscode';
import { DeployedFunction, FunctionContent, FunctionObject, FunctionStatus } from './types';
import { ServerlessCommand, Utils } from './commands';
import { OdoImpl } from '../odo';
import { Functions } from './functions';
import { stringify } from 'yaml';
import { CliChannel, CliExitData } from '../cli';
import * as cp from 'child_process';
import { VsCommandError } from '../vscommand';
import { CommandText } from '../base/command';
import { DeploymentConfig } from '../k8s/deploymentConfig';
import { ServerlessFunctionView } from './view';

export interface ServerlessFunction {
    getLocalFunctions(): Promise<FunctionObject[]>;
    createFunction(language: string, template: string, location: string, image: string): Promise<CliExitData>;
}

export class ServerlessFunctionImpl implements ServerlessFunction {

    private static instance: ServerlessFunction;

    public static get Instance(): ServerlessFunction {
        if (!ServerlessFunctionImpl.instance) {
            ServerlessFunctionImpl.instance = new ServerlessFunctionImpl();
        }
        return ServerlessFunctionImpl.instance;
    }

    private async getListItems(command: CommandText, fail = false) {
        const listCliExitData = await CliChannel.getInstance().executeTool(command, undefined, fail);
        try {
            return JSON.parse(listCliExitData.stdout) as FunctionObject[];
        } catch (err) {
            return [];
        }
    }

    private async getDeployedFunctions(): Promise<FunctionObject[]> {
        return this.getListItems(DeploymentConfig.command.getDeploymentFunctions());
    }

    async createFunction(language: string, template: string, location: string, image: string): Promise<CliExitData> {
        let funnctionResponse: CliExitData;
        try {
            const response = await OdoImpl.Instance.execute(ServerlessCommand.createFunction(language, template, location));
            if (response && !response.error) {
                const yamlContent = await Utils.getFuncYamlContent(location);
                if (yamlContent) {
                    yamlContent.image = image;
                    fs.rmSync(path.join(location, 'func.yaml'));
                    fs.writeFileSync(path.join(location, 'func.yaml'), stringify(yamlContent), 'utf-8');
                    funnctionResponse = {
                        error: undefined,
                        stderr: '',
                        stdout: 'Success'
                    };
                }
            } else {
                fs.rmdirSync(location);
                funnctionResponse = response;
            }
        } catch (err) {
            if (err instanceof VsCommandError) {
                void window.showErrorMessage(err.message);
            }
            fs.rmdirSync(location);
            funnctionResponse = {
                error: err as cp.ExecException,
                stderr: '',
                stdout: ''
            }
        }
        return funnctionResponse;
    }

    async getLocalFunctions(): Promise<FunctionObject[]> {
        const functionList: FunctionObject[] = [];
        const folders: Uri[] = [];
        if (workspace.workspaceFolders) {
            // eslint-disable-next-line no-restricted-syntax
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
                const deployFunction: DeployedFunction = this.getDeployFunction(funcData, deployedFunctions);
                const functionNode: FunctionObject = {
                    name: funcData.name,
                    runtime: funcData.runtime,
                    folderURI: folderUri,
                    context: deployFunction.status,
                    url: deployFunction.url,
                    hasImage: await this.checkImage(folderUri),
                    isRunning: Functions.getInstance().checkRunning(folderUri.fsPath)
                }
                functionList.push(functionNode);
                fs.watchFile(path.join(folderUri.fsPath, 'func.yaml'), (_eventName, _filename) => {
                    ServerlessFunctionView.getInstance().refresh();
                });
            }
        }
        if (deployedFunctions.length > 0) {
            for (const deployedFunction of deployedFunctions) {
                if (functionList.filter((functionParam) => functionParam.name === deployedFunction.name).length === 0) {
                    const functionNode: FunctionObject = {
                        name: deployedFunction.name,
                        runtime: deployedFunction.runtime,
                        context: FunctionStatus.CLUSTERONLY
                    }
                    functionList.push(functionNode);
                }
            }
        }
        return functionList;
    }

    getDeployFunction(funcData: FunctionContent, deployedFunctions: FunctionObject[]): DeployedFunction {
        if (deployedFunctions.length > 0) {
            const func = deployedFunctions.find((deployedFunction) => deployedFunction.name === funcData.name && deployedFunction.namespace === funcData.deploy?.namespace)
            if (func) {
                return {status: FunctionStatus.CLUSTERLOCALBOTH, url: func.url} as DeployedFunction
            }
        }
        return {status: FunctionStatus.LOCALONLY, url: ''} as DeployedFunction
    }

    async checkImage(folderUri: Uri): Promise<boolean> {
        const yamlContent = await Utils.getFuncYamlContent(folderUri.fsPath);
        return Functions.imageRegex.test(yamlContent?.image);
    }
}

export function serverlessInstance(): ServerlessFunction {
    return ServerlessFunctionImpl.Instance;
}
