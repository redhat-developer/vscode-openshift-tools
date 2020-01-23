/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as odo from '../../src/odo';
import { Cluster } from '../../src/openshift/cluster';

suite('odo integration', () => {
    const oi: odo.Odo = odo.getInstance();
    let sb: sinon.SinonSandbox;

    setup(() => {
        sb = sinon.createSandbox();
        sb.stub(vscode.window, 'showInformationMessage').resolves('Download and install');
    });

    teardown(() => {
        sb.restore();
    });

    suite('explorer', ()=> {

        test('getClusters()', async () => {
            const clusters = await oi.getClusters();
            assert.ok(clusters.length > 0);
        });

        test('getProjects()', async () => {
            const projects = await oi.getProjects();
            assert.ok(projects.length > 0);
        });

        test('about()', async () => {
            await Cluster.about();
            assert.ok(true);
        });
    });
});
