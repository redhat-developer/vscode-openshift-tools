/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import sendTelemetry from '../telemetry';
import * as Helm from '../../src/helm/helm';
import { HelmRepo } from './helmChartType';
import { OpenShiftExplorer } from '../explorer';
import { vsCommand } from '../vscommand';
import { ascRepoName } from '../../src/helm/helm';
import ManageRepositoryViewLoader from '../webview/helm-manage-repository/manageRepositoryLoader';
import HelmChartLoader from '../webview/helm-chart/helmChartLoader';
import { inputValue } from '../util/inputValue';
import validator from 'validator';
import { Progress } from '../util/progress';

export class ManageRepository {

    private static instance: ManageRepository;

    static getInstance(): ManageRepository {
        if (!ManageRepository.instance) {
            ManageRepository.instance = new ManageRepository();
        }
        return ManageRepository.instance;
    }

    /**
    * sync the repository
    *
    * @param repository
    */
    @vsCommand('openshift.helm.sync')
    public async sync(repo: HelmRepo): Promise<void> {
        await Progress.execFunctionWithProgress(`pulling ${repo.name} repository with latest`, async () => {
            const flag = await ManageRepository.getInstance().syncRepo(repo.name);
            if (flag) {
                await ManageRepository.getInstance().refresh();
            }
        });
    }

    /**
    * edit the repository
    *
    * @param repository
    * @returns true if repo edited successfully
    */
    @vsCommand('openshift.helm.add')
    public async add(_repo = undefined, newName: string, newURL: string, isWebview = false): Promise<boolean> {
        return await vscode.commands.executeCommand('openshift.helm.edit', undefined, newName, newURL, true, isWebview);
    }

    /**
    * edit the repository
    *
    * @param repository
    * @returns true if repo edited successfully
    */
    @vsCommand('openshift.helm.edit')
    public async edit(repo: HelmRepo, newName: string, newURL: string, isAdd = false, isWebview = false): Promise<boolean> {
        enum listOfStep {
            enterRepositoryName,
            enterRepositoryURL
        };
        let step: listOfStep = listOfStep.enterRepositoryName;
        let repoName: string = repo?.name;
        let repoURL: string = repo?.url;
        const repositories = (await ManageRepository.getInstance().list()).sort(ascRepoName);
        if (!isWebview) {
            while (step !== undefined) {
                switch (step) {
                    case listOfStep.enterRepositoryName: {
                        // ask for repository
                        repoName = await inputValue(repo ? 'Edit repository name' : 'Provide repository name',
                            repoName,
                            false,
                            (value: string) => {
                                const trimmedValue = value.trim();
                                if (trimmedValue.length === 0) {
                                    return 'Repository name cannot be empty';
                                } else if (!validator.isLength(trimmedValue, { min: 2, max: 63 })) {
                                    return 'Repository name should be between 2-63 characters'
                                } else if (!validator.matches(trimmedValue, '^[a-z]([-a-z0-9]*[a-z0-9])*$')) {
                                    return 'Repository name can have only alphabet characters and numbers';
                                }
                                if (repositories?.find((repository) => repository.name !== repoName && repository.name === value)) {
                                    return `Repository name '${value}' is already used`;
                                }
                            },
                            'Repository Name'
                        );
                        if (!repoName) return null; // Back or cancel
                        step = listOfStep.enterRepositoryURL;
                        break;
                    }
                    case listOfStep.enterRepositoryURL: {
                        repoURL = await inputValue(repo ? 'Edit repository URL' : 'Provide repository URL',
                            repoURL,
                            false,
                            (value: string) => {
                                try {
                                    const trimmedValue = value.trim();
                                    if (!validator.isURL(trimmedValue)) {
                                        return 'Entered URL is invalid';
                                    }
                                    if (repositories?.find((registry) => registry.url !== repoURL && new URL(registry.url).hostname === new URL(value).hostname)) {
                                        return `Repository with entered URL '${value}' already exists`;
                                    }
                                } catch (Error) {
                                    return 'Entered URL is invalid';
                                }
                            },
                            'Repository URL'
                        );
                        if (repoURL === null) return null; // Cancel
                        if (!repoURL) step = listOfStep.enterRepositoryName; // Back
                        else step = undefined;
                        break;
                    }
                    default: {
                        return; // Shouldn't happen. Exit
                    }
                }
            }
        } else {
            repoName = newName;
            repoURL = newURL;
        }

        let flag: boolean;

        if (isAdd) {
            await Progress.execFunctionWithProgress(`Adding repository ${repoName}`, async () => {
                flag = await ManageRepository.getInstance().addRepo(repoName, repoURL);
            });
        } else {
            flag = await ManageRepository.getInstance().editRepo(repo, repoName, repoURL, true);
        }

        if (flag) {
            await ManageRepository.getInstance().refresh();
            const message = isAdd ? 'added' : 'updated';
            void vscode.window.showInformationMessage(`Helm Repository ${repoName} ${message} successfully`);
        }
        return flag;
    }

    /**
    * delete the repository
    *
    * @param repository
    * @returns true if repo deleted successfully
    */
    @vsCommand('openshift.helm.delete')
    public async delete(repo: HelmRepo, isWebview = false): Promise<void> {
        const yesNo = isWebview ? 'Yes' : await vscode.window.showInformationMessage(
            `Are you sure want to delete ${repo.name} helm repository'?`,
            'Yes',
            'No',
        );
        if (yesNo === 'Yes') {
            const flag = await ManageRepository.getInstance().deleteRepo(repo);
            if (flag) {
                await ManageRepository.getInstance().refresh();
                void vscode.window.showInformationMessage(`Helm Repository ${repo.name} deleted successfully`);
            }
        }
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

    private async refresh() {
        OpenShiftExplorer.getInstance().refresh();
        const repositories = (await ManageRepository.getInstance().list()).sort(ascRepoName);
        void ManageRepositoryViewLoader.panel?.webview.postMessage({
            action: 'getRepositoryList',
            repositories
        });
        await HelmChartLoader.getHelmCharts();
    }

    private async syncRepo(repoName: string): Promise<boolean> {
        await sendTelemetry('openshift.helm.manageRepo.sync', {
            repoName
        });
        const result = await Helm.syncHelmRepo(repoName);
        if (result.stderr || result.error) {
            const error = result.stderr || result.error?.message;
            await sendTelemetry('openshift.helm.manageRepo.sync.error', {
                error
            });
            void vscode.window.showErrorMessage(error);
            return false;
        }
        void vscode.window.showInformationMessage(result.stdout.substring(result.stdout.toLowerCase().lastIndexOf('successfully')));
        return true;
    }

    private async deleteRepo(repo: HelmRepo): Promise<boolean> {
        const repoName = repo.name;
        await sendTelemetry('openshift.helm.manageRepo.delete', {
            repoName
        });
        const result = await Helm.deleteHelmRepo(repoName);
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

    private async editRepo(oldRepo: HelmRepo, newName: string, newURL: string, isEdit = false): Promise<boolean> {
        await sendTelemetry('openshift.helm.manageRepo.edit', {
            oldRepo,
            newName,
            newURL
        });

        // delete old repo
        let result = await ManageRepository.getInstance().deleteRepo(oldRepo);
        if (result) {
            //add new repo
            result = await ManageRepository.getInstance().addRepo(newName, newURL);
            if (!result) {
                await ManageRepository.getInstance().addRepo(oldRepo.name, oldRepo.url);
                return false;
            }
            await sendTelemetry('openshift.helm.manageRepo.edit.success', {
                message: `Repo ${newName} updated successfully`
            });
            return true;
        }
        return result;
    }

    private async addRepo(name: string, url: string): Promise<boolean> {
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
        return true;
    }
}
