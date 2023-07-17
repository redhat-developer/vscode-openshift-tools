/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as fs from 'fs-extra';
import { Uri, workspace } from 'vscode';
import { FunctionContent, FunctionObject, FunctionStatus } from './types';
import { ServerlessFunctionView } from './view';
import { ServerlessCommand, Utils } from './commands';
import { OdoImpl } from '../odo';
import { BuildAndDeploy } from './build-run-deploy';
import { stringify } from 'yaml';
import { CliExitData } from '../cli';
import * as cp from 'child_process';

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

    /*private async getListItems<T>(command: CommandText, fail = false) {
        const listCliExitData = await CliChannel.getInstance().executeTool(command, undefined, fail);
        const result = loadItems<T>(listCliExitData.stdout);
        return result;
    }

    private async getDeployedFunctions(): Promise<FunctionObject[]> {
        //set context value to deploy
        return this.getListItems<FunctionObject>(DeploymentConfig.command.getDeploymentFunctions());
    }*/

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
        //const deployedFunctions = await this.getDeployedFunctions();
        const folders: Uri[] = [];
        const functionList: FunctionObject[] = [];
        if (workspace.workspaceFolders) {
            // eslint-disable-next-line no-restricted-syntax
            for (const wf of workspace.workspaceFolders) {
                if (fs.existsSync(path.join(wf.uri.fsPath, 'func.yaml'))) {
                    folders.push(wf.uri);
                }
            }
        }
        const currentNamespace: string = ServerlessFunctionView.getInstance().getCurrentNameSpace();
        // eslint-disable-next-line no-console
        console.log(currentNamespace);
        for (const folderUri of folders) {
            const funcStatus = FunctionStatus.LOCALONLY;
            const funcData: FunctionContent = await Utils.getFuncYamlContent(folderUri.fsPath);
            /*if (
                functionTreeView.has(funcData?.name) &&
                (!funcData?.deploy?.namespace || getCurrentNamespace === funcData?.deploy?.namespace)
              ) {
                funcStatus = FunctionStatus.CLUSTERLOCALBOTH;
              }
              fs.watch(folderUri.fsPath, (eventName, filename) => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                //functionExplorer.refresh();
              });
              if (funcData?.name) {
                const url =
                  func.contextValue !== FunctionContextType.FAILNAMESPACENODE && funcData?.image.trim()
                    ? functionTreeView.get(funcData?.name)?.url
                    : undefined;
                functionTreeView.set(funcData?.name, this.createFunctionNodeImpl(func, funcData, folderUri, funcStatus, url));
              }*/
            const functionNode: FunctionObject = {
                name: funcData.name,
                runtime: funcData.runtime,
                folderURI: folderUri,
                context: funcStatus,
                hasImage: await this.checkImage(folderUri),
                isRunning: BuildAndDeploy.getInstance().checkRunning(folderUri.fsPath)
            }
            functionList.push(functionNode);
        }
        return functionList;
    }

    async checkImage(folderUri: Uri): Promise<boolean> {
        const yamlContent = await Utils.getFuncYamlContent(folderUri.fsPath);
        return BuildAndDeploy.imageRegex.test(yamlContent?.image);
    }
}

export function serverlessInstance(): ServerlessFunction {
    return ServerlessFunctionImpl.Instance;
}
