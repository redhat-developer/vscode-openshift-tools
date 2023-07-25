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
    const clusterUrl = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
    const username = process.env.CLUSTER_USER || 'developer';
    const password = process.env.CLUSTER_PASSWORD || 'developer';

    const odo = getInstance();

    const RELEASE_NAME = 'my-helm-release';
    const CHART_NAME = 'janus-idp-backstage';
    const CHART_VERSION = '2.2.0';

    setup(async function () {
        await odo.execute(Command.odoLoginWithUsernamePassword(clusterUrl, username, password));
    });

    teardown(async function () {
        try {
            await Helm.unInstallHelmChart(CHART_NAME);
        } catch (_) {
            // do nothing
        }
        await odo.execute(Command.odoLogout());
    });

    test('installs OpenShift repo', async function () {
        await Helm.addHelmRepo();
        const repoListOutput = (await CliChannel.getInstance().executeTool(new CommandText('helm', 'repo list'))).stdout;
        expect(repoListOutput).to.contain('openshift');
        expect(repoListOutput).to.contain('https://charts.openshift.io/');
    });

    test('installs a chart as a release', async function () {
        await Helm.installHelmChart(RELEASE_NAME, CHART_NAME, CHART_VERSION);
        const releases = await Helm.getHelmReleases();
        const janusRelease = releases.find(release => release.name === RELEASE_NAME);
        expect(janusRelease).to.exist;
    });

    test('uninstalls a release', async function () {
        await Helm.unInstallHelmChart(RELEASE_NAME);
        const releases = await Helm.getHelmReleases();
        const janusRelease = releases.find(release => release.name === RELEASE_NAME);
        expect(janusRelease).to.not.exist;
    });

});
