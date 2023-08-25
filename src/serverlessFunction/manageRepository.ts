/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Odo } from '../odo/odoWrapper';
import sendTelemetry from '../telemetry';
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
        await sendTelemetry('openshift.managerepo.delete', {
            name
        });
        const result = await Odo.Instance.execute(ServerlessCommand.deleteRepo(name), '', false);
        if (result.error) {
            await sendTelemetry('openshift.managerepo.delete.error', {
                error: result.error.message
            });
            void vscode.window.showErrorMessage(result.error.message);
            return false;
        }
        return true;
    }

    public async renameRepo(oldName: string, newName: string): Promise<boolean> {
        await sendTelemetry('openshift.managerepo.rename', {
            oldName,
            newName
        });
        const result = await Odo.Instance.execute(ServerlessCommand.renameRepo(oldName, newName), '', false);
        if (result.error) {
            await sendTelemetry('openshift.managerepo.rename.error', {
                error: result.error.message
            });
            void vscode.window.showErrorMessage(result.error.message);
            return false;
        }
        await sendTelemetry('openshift.managerepo.rename.success', {
            message: `Repo ${newName} renamed successfully`
        });
        return true;
    }

    public async addRepo(name: string, url: string): Promise<boolean> {
        await sendTelemetry('openshift.managerepo.add', {
            name, url
        });
        const result = await Odo.Instance.execute(ServerlessCommand.addRepo(name, url), '', false);
        if (result.error) {
            await sendTelemetry('openshift.managerepo.add.error', {
                error: result.error.message
            });
            void vscode.window.showErrorMessage(result.error.message);
            return false;
        } else if (result.stdout.length === 0 && result.stderr.length === 0) {
            await sendTelemetry('openshift.managerepo.add.success', {
                name,
                message: 'Repo added successfully'
            });
            void vscode.window.showInformationMessage(`Repository ${name} added successfully`);
            return true;
        }
        await sendTelemetry('openshift.managerepo.add.error', {
            error: result.stderr
        });
        return false;
    }

    public async list(): Promise<string[]> {
        await sendTelemetry('openshift.managerepo.list');
        const result = await Odo.Instance.execute(ServerlessCommand.list(), '', false);
        if (result.error) {
            await sendTelemetry('openshift.managerepo.list.error', {
                error: result.error.message
            });
            void vscode.window.showErrorMessage(result.error.message);
            return [];
        }
        await sendTelemetry('openshift.managerepo.list.success', {
            repos: result.stdout.split('\n')
        });
        return result.stdout.split('\n');
    }
}
