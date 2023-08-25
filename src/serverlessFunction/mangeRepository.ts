/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { OdoImpl } from '../odo';
import { Progress } from '../util/progress';
import { ServerlessCommand } from './commands';

export class ManageRepository {

    private static instance: ManageRepository;

    static getInstance(): ManageRepository {
        if (!ManageRepository.instance) {
            ManageRepository.instance = new ManageRepository();
        }
        return ManageRepository.instance;
    }

    public async deleteRepo(name: string): Promise<boolean> {
        const result = await OdoImpl.Instance.execute(ServerlessCommand.deleteRepo(name), '', false);
        if (result.error) {
            void vscode.window.showErrorMessage(result.error.message);
            return false;
        }
        return true;
    }

    public async renameRepo(oldName: string, newName: string): Promise<boolean> {
        const result = await OdoImpl.Instance.execute(ServerlessCommand.renameRepo(oldName, newName), '', false);
        if (result.error) {
            void vscode.window.showErrorMessage(result.error.message);
            return false;
        }
        return true;
    }

    public addRepo(name: string, url: string): Promise<boolean> {
        return new Promise<boolean>((resolve, _reject) => {
            void Progress.execFunctionWithProgress(`Adding repository ${name}`, async () => {
                const result = await OdoImpl.Instance.execute(ServerlessCommand.addRepo(name, url), '', false);
                if (result.error) {
                    void vscode.window.showErrorMessage(result.error.message);
                    resolve(false);
                } else if (result.stdout.length === 0) {
                    void vscode.window.showInformationMessage(`Repository ${name} added successfully`);
                    resolve(true);
                }
            });
        });
    }

    public async list(): Promise<string[]> {
        const result = await OdoImpl.Instance.execute(ServerlessCommand.list(), '', false);
        if (result.error) {
            void vscode.window.showErrorMessage(result.error.message);
            return [];
        }
        return result.stdout.split('\n');
    }
}
