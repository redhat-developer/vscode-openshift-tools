/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as fs from 'fs-extra';
import { parse } from 'yaml';
import { CommandText } from '../base/command';
import { CliChannel } from '../cli';
import { loadItems } from '../k8s/common';
import { DeploymentConfig } from '../k8s/deploymentConfig';
import { Uri, workspace } from 'vscode';
import { FunctionContent, FunctionObject } from './types';

export interface ServerlessFunction {
    getLocalFunctions(): Promise<FunctionObject[]>;
    getDeployedFunctions(): Promise<FunctionObject[]>;
}

export class ServerlessFunctionImpl implements ServerlessFunction {

    private async getListItems<T>(command: CommandText, fail = false) {
        const listCliExitData = await CliChannel.getInstance().executeTool(command, undefined, fail);
        const result = loadItems<T>(listCliExitData.stdout);
        return result;
    }

    private async getFuncYamlContent(dir: string): Promise<FunctionContent> {
        let funcData: FunctionContent;
        try {
            const funcYaml: string = await fs.readFile(path.join(dir, 'func.yaml'), 'utf-8');
            funcData = parse(funcYaml) as FunctionContent;
        } catch (error) {
            // ignore
        }
        return funcData;
    }

    async getDeployedFunctions(): Promise<FunctionObject[]> {
        //set context value to deploy
        return this.getListItems<FunctionObject>(DeploymentConfig.command.getDeploymentFunctions());
    }

    async getLocalFunctions(): Promise<FunctionObject[]> {
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
        //const getCurrentNamespace: string = await activeNamespace();
        for (const folderUri of folders) {
            const funcStatus = 'local';
            const funcData: FunctionContent = await this.getFuncYamlContent(folderUri.fsPath);
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
                context: funcStatus
              }
              functionList.push(functionNode);
        }
        return functionList;
    }
}

export function newInstance(): ServerlessFunction {
    return new ServerlessFunctionImpl();
}
