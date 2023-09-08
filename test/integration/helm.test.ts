/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { CommandText } from '../../src/base/command';
import { CliChannel } from '../../src/cli';
import * as Helm from '../../src/helm/helm';
import { getInstance } from '../../src/odo';
import { Command } from '../../src/odo/command';

suite('helm integration', function () {
    const isOpenShift = process.env.IS_OPENSHIFT || false;
    const clusterUrl = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
    const username = process.env.CLUSTER_USER || 'developer';
    const password = process.env.CLUSTER_PASSWORD || 'developer';

    const odo = getInstance();

    const RELEASE_NAME = 'my-helm-release';
    const CHART_NAME = 'fredco-samplechart';
    const CHART_VERSION = '0.1.3';
    const HELM_NAMESPACE = 'my-helm-charts';

    suiteSetup(async function () {
        if (isOpenShift) {
            await odo.execute(Command.odoLoginWithUsernamePassword(clusterUrl, username, password));
        }
        try {
            await odo.deleteProject(HELM_NAMESPACE);
        } catch (e) {
            // do nothing
        }
        await odo.createProject(HELM_NAMESPACE);
    });

    suiteTeardown(async function () {
        try {
            await Helm.unInstallHelmChart(CHART_NAME);
        } catch (_) {
            // do nothing
        }
        // this call fails to exit on minikube/kind
        void odo.deleteProject(HELM_NAMESPACE);
        if (isOpenShift) {
            await odo.execute(Command.odoLogout());
        }
    });

    test('installs OpenShift repo', async function () {
        await Helm.addHelmRepo();
        const repoListOutput = (
            await CliChannel.getInstance().executeTool(new CommandText('helm', 'repo list'))
        ).stdout;
        expect(repoListOutput).to.contain('openshift');
        expect(repoListOutput).to.contain('https://charts.openshift.io/');
    });

    test('installs a chart as a release', async function () {
        await Helm.installHelmChart(RELEASE_NAME, CHART_NAME, CHART_VERSION);
        const releases = await Helm.getHelmReleases();
        const sampleChartRelease = releases.find((release) => release.name === RELEASE_NAME);
        expect(sampleChartRelease).to.exist;
    });

    test('uninstalls a release', async function () {
        await Helm.unInstallHelmChart(RELEASE_NAME);
        const releases = await Helm.getHelmReleases();
        const sampleChartRelease = releases.find((release) => release.name === RELEASE_NAME);
        expect(sampleChartRelease).to.not.exist;
    });
});
