/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import sendTelemetry from '../telemetry';
import * as Helm from '../../src/helm/helm';
import { HelmRepo } from './helmChartType';

export class ManageRepository {

    private static instance: ManageRepository;

    static getInstance(): ManageRepository {
        if (!ManageRepository.instance) {
            ManageRepository.instance = new ManageRepository();
        }
        return ManageRepository.instance;
    }

    public async updateRepo(repoName: string): Promise<boolean> {
        await sendTelemetry('openshift.helm.manageRepo.update', {
            repoName
        });
        const result = await Helm.updateHelmRepo(repoName);
        if (result.stderr || result.error) {
            const error = result.stderr || result.error?.message;
            await sendTelemetry('openshift.helm.manageRepo.update.error', {
                error
            });
            void vscode.window.showErrorMessage(error);
            return false;
        }
        void vscode.window.showInformationMessage(result.stdout.substring(result.stdout.toLowerCase().lastIndexOf('successfully')));
        return true;
    }

    public async deleteRepo(name: string): Promise<boolean> {
        await sendTelemetry('openshift.helm.manageRepo.delete', {
            name
        });
        const result = await Helm.deleteHelmRepo(name);
        if (result.stderr || result.error) {
            const error = result.stderr || result.error?.message;
            await sendTelemetry('openshift.helm.manageRepo.delete.error', {
                error
            });
            void vscode.window.showErrorMessage(error);
            return false;
        }
        return true;
    }

    public async editRepo(oldRepo: HelmRepo, newName: string, newURL: string): Promise<boolean> {
        await sendTelemetry('openshift.helm.manageRepo.edit', {
            oldRepo,
            newName,
            newURL
        });

        // delete old repo
        let result = await Helm.deleteHelmRepo(oldRepo.name);
        if (result.stderr || result.error) {
            const error = result.stderr || result.error?.message;
            await sendTelemetry('openshift.helm.manageRepo.delete.oldRepo.error', {
                error
            });
            void vscode.window.showErrorMessage(error);
            return false;
        }

        //add new repo
        result = await Helm.addHelmRepo(newName, newURL);
        if (result.stderr || result.error) {
            const error = result.stderr || result.error?.message;
            await sendTelemetry('openshift.helm.manageRepo.edit.newRepo.error', {
                error
            });
            await Helm.addHelmRepo(oldRepo.name, oldRepo.url);
            void vscode.window.showErrorMessage(error);
            return false;
        }
        await sendTelemetry('openshift.helm.manageRepo.edit.success', {
            message: `Repo ${oldRepo.name} edited successfully`
        });
        return true;
    }

    public async addRepo(name: string, url: string): Promise<boolean> {
        await sendTelemetry('openshift.helm.manageRepo.add', {
            name, url
        });
        const result = await Helm.addHelmRepo(name, url);
        if (result.stderr || result.error) {
            const error = result.stderr || result.error?.message;
            await sendTelemetry('openshift.helm.manageRepo.add.error', {
                error
            });
            void vscode.window.showErrorMessage(error);
            return false;
        }
        await sendTelemetry('openshift.helm.manageRepo.add.success', {
            name,
            message: 'Repo added successfully'
        });
        void vscode.window.showInformationMessage(`Repository ${name} added successfully`);
        return true;
    }

    public async list(): Promise<HelmRepo[]> {
        await sendTelemetry('openshift.helm.manageRepo.list');
        const result = await Helm.getHelmRepos();
        if (result.stderr || result.error) {
            const error = result.stderr || result.error?.message;
            await sendTelemetry('openshift.helm.manageRepo.list.error', {
                error
            });
            void vscode.window.showErrorMessage(error);
            return [];
        }
        const helmRepos = JSON.parse(result.stdout) as HelmRepo[];
        await sendTelemetry('openshift.helm.manageRepo.list.success', {
            helmRepos
        });
        return helmRepos;
    }
}
