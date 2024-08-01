/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import * as Helm from '../../src/helm/helm';
import { Oc } from '../../src/oc/ocWrapper';
import { LoginUtil } from '../../src/util/loginUtil';

suite('helm integration', function () {
    const isOpenShift: boolean = Boolean(parseInt(process.env.IS_OPENSHIFT, 10)) || false;
    const clusterUrl = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
    const username = process.env.CLUSTER_USER || 'developer';
    const password = process.env.CLUSTER_PASSWORD || 'developer';

    const oc = Oc.Instance;

    const RELEASE_NAME = 'my-helm-release';
    const REPO_NAME = 'bitnami';
    const CHART_NAME = 'discourse';
    const CHART_VERSION = '12.8.0';
    const HELM_NAMESPACE = 'my-helm-charts';

    suiteSetup(async function () {
        if (isOpenShift) {
            await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
        }
        try {
            await oc.deleteProject(HELM_NAMESPACE);
        } catch {
            // do nothing
        }
        await oc.createProject(HELM_NAMESPACE);
    });

    suiteTeardown(async function () {
        try {
            await Helm.unInstallHelmChart(CHART_NAME);
        } catch {
            // do nothing
        }
        // this call fails to exit on minikube/kind
        void oc.deleteProject(HELM_NAMESPACE);
        if (isOpenShift) {
            await LoginUtil.Instance.logout();
        }
    });

    test('installs OpenShift repo', async function () {
        await Helm.addHelmRepo('bitnami','https://charts.bitnami.com/bitnami');
        const repoListOutput = (await Helm.getHelmRepos()).stdout;
        expect(repoListOutput).to.contain('bitnami');
        expect(repoListOutput).to.contain('https://charts.bitnami.com/bitnami');
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
