/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { CommandText } from '../base/command';
import { CliChannel } from '../cli';
import { CliExitData } from '../util/childProcessUtil';
import { HelmRepo } from './helmChartType';
import * as HelmCommands from './helmCommands';

export type HelmRelease = {
    name?: string;
    namespace?: string;
    revision?: string;
    updated?: string;
    status?: string;
    chart: string;
    app_version?: string;
};

/**
 * Returns a list of all Helm releases in the current namespace on the current cluster.
 *
 * @returns a list of all Helm releases in the current namespace on the current cluster
 */
export async function getHelmReleases(): Promise<HelmRelease[]> {
    const res = await CliChannel.getInstance().executeTool(HelmCommands.listHelmReleases(), undefined, false);
    return JSON.parse(res.stdout) as HelmRelease[];
}

/**
 * Adds the OpenShift Helm repo to the cluster.
 *
 * @returns the CLI output data from running the necessary command
 */
export async function addHelmRepo(repoName: string, url: string): Promise<CliExitData> {
    return await CliChannel.getInstance().executeTool(HelmCommands.addHelmRepo(repoName, url), undefined, false);
}

/**
 * Delete the OpenShift Helm repo to the cluster.
 *
 * @returns the CLI output data from running the necessary command
 */
export async function deleteHelmRepo(repoName: string): Promise<CliExitData> {
    return await CliChannel.getInstance().executeTool(HelmCommands.deleteRepo(repoName), undefined, false);
}

export async function getHelmRepos(): Promise<CliExitData> {
    return await CliChannel.getInstance().executeTool(HelmCommands.getRepos(), undefined, false);
}

/**
 * sync the repository to get latest
 *
 * @param repoName the name of the repo to synchronize
 *
 * @returns the CLI output data from running the necessary command
 */
export async function syncHelmRepo(repoName: string): Promise<CliExitData> {
    return await CliChannel.getInstance().executeTool(HelmCommands.syncHelmRepo(repoName), undefined, false);
}

/**
 * Install a chart from the OpenShift Helm Repo
 *
 * @param name the name of the release
 * @param repoName the name of the helm repo
 * @param chartName the name of the chart to install
 * @param version the version of the chart to use for the release
 * @returns the CLI output data from running the necessary command
 */
export async function installHelmChart(
    name: string,
    repoName: string,
    chartName: string,
    version: string,
): Promise<CliExitData> {
    await syncHelmRepo(repoName);
    return await CliChannel.getInstance().executeTool(
        HelmCommands.installHelmChart(name, repoName, chartName, version), undefined, false
    );
}

/**
 * Uninstalls the given Helm release from the cluster.
 *
 * @param name the name of the Helm release to uninstall
 * @returns the CLI output data from running the necessary command
 */
export async function unInstallHelmChart(name: string): Promise<CliExitData> {
    return await CliChannel.getInstance().executeTool(HelmCommands.unInstallHelmChart(name), undefined, false);
}

/**
 * Compare the repos based on the name, placing the openshift repo at the beginning.
 *
 * @param oldRepo the first repo to compare
 * @param newRepo the second repo to compare
 * @returns a negative number if the first entry should go first, or a positive number if the second entry should go first
 */
export function ascRepoName(oldRepo: HelmRepo, newRepo: HelmRepo) {
    const oldURLCheck = oldRepo.url.toLowerCase().includes('charts.openshift.io');
    const newURLCheck = newRepo.url.toLowerCase().includes('charts.openshift.io');
    if (oldURLCheck && !newURLCheck) {
        return -1;
    } else if (newURLCheck && !oldURLCheck) {
        return 1;
    }
    return oldRepo.name.localeCompare(newRepo.name);
}

// This file contains utilities for executing command line tools, notably Helm.

export enum HelmSyntaxVersion {
    Unknown = 1,
    V2 = 2,
    V3 = 3,
}

let cachedVersion: HelmSyntaxVersion | undefined = undefined;

export async function helmSyntaxVersion(): Promise<HelmSyntaxVersion> {
    if (cachedVersion === undefined) {
        const srHelm2 = await CliChannel.getInstance().executeTool(new CommandText('helm version --short -c'));
        if (CliExitData.failed(srHelm2)) {
            // failed to run Helm; do not cache result
            return HelmSyntaxVersion.Unknown;
        }

        if (srHelm2.stdout.indexOf('v2') >= 0) {
            cachedVersion = HelmSyntaxVersion.V2;
        } else {
            const srHelm3 = await CliChannel.getInstance().executeTool(new CommandText('helm version --short'));
            if (!CliExitData.failed(srHelm3) && srHelm3.stdout.indexOf('v3') >= 0) {
                cachedVersion = HelmSyntaxVersion.V3;
            } else {
                return HelmSyntaxVersion.Unknown;
            }
        }
    }
    return cachedVersion;
}
