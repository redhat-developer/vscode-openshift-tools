/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import * as Helm from '../../src/helm/helm';
import { Oc } from '../../src/oc/ocWrapper';
import { Odo } from '../../src/odo/odoWrapper';

suite('helm integration', function () {
    const isOpenShift: boolean = Boolean(parseInt(process.env.IS_OPENSHIFT, 10)) || false;
    const clusterUrl = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
    const username = process.env.CLUSTER_USER || 'developer';
    const password = process.env.CLUSTER_PASSWORD || 'developer';

    const odo = Odo.Instance;

    const RELEASE_NAME = 'my-helm-release';
    const REPO_NAME = 'openshift';
    const CHART_NAME = 'fredco-samplechart';
    const CHART_VERSION = '0.1.3';
    const HELM_NAMESPACE = 'my-helm-charts';

    suiteSetup(async function () {
        if (isOpenShift) {
            await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
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
            await Oc.Instance.logout();
        }
    });

    test('installs OpenShift repo', async function () {
        await Helm.addHelmRepo('openshift','https://charts.openshift.io/');
        const repoListOutput = (await Helm.getHelmRepos()).stdout;
        expect(repoListOutput).to.contain('openshift');
        expect(repoListOutput).to.contain('https://charts.openshift.io/');
    });

    test('installs a chart as a release', async function () {
        await Helm.installHelmChart(RELEASE_NAME, REPO_NAME, CHART_NAME, CHART_VERSION);
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
