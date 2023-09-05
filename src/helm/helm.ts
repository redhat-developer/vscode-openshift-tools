/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { CliChannel } from '../cli';
import { CliExitData } from '../util/childProcessUtil';
import * as HelmCommands from './helmCommands';

export type HelmRelease = {
    name: string;
    namespace: string;
    revision: string;
    updated: string;
    status: string;
    chart: string;
    app_version: string;
};

/**
 * Returns a list of all Helm releases in the current namespace on the current cluster.
 *
 * @returns a list of all Helm releases in the current namespace on the current cluster
 */
export async function getHelmReleases(): Promise<HelmRelease[]> {
    const res = await CliChannel.getInstance().executeTool(HelmCommands.listHelmReleases());
    return JSON.parse(res.stdout) as HelmRelease[];
}

/**
 * Adds the OpenShift Helm repo to the cluster.
 *
 * @returns the CLI output data from running the necessary command
 */
export async function addHelmRepo(): Promise<CliExitData> {
    return await CliChannel.getInstance().executeTool(HelmCommands.addHelmRepo());
}

/**
 * Updates the content of all the Helm repos.
 *
 * @returns the CLI output data from running the necessary command
 */
export async function updateHelmRepo(): Promise<CliExitData> {
    return await CliChannel.getInstance().executeTool(HelmCommands.updateHelmRepo());
}

/**
 * Install a chart from the OpenShift Helm Repo
 *
 * @param name the name of the release
 * @param chartName the name of the chart to install
 * @param version the version of the chart to use for the release
 * @returns the CLI output data from running the necessary command
 */
export async function installHelmChart(
    name: string,
    chartName: string,
    version: string,
): Promise<CliExitData> {
    return await CliChannel.getInstance().executeTool(
        HelmCommands.installHelmChart(name, chartName, version),
    );
}

/**
 * Uninstalls the given Helm release from the cluster.
 *
 * @param name the name of the Helm release to uninstall
 * @returns the CLI output data from running the necessary command
 */
export async function unInstallHelmChart(name: string): Promise<CliExitData> {
    return await CliChannel.getInstance().executeTool(HelmCommands.unInstallHelmChart(name));
}
