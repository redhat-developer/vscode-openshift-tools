/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import { OpenShiftExplorer } from '../src/explorer';
import { OdoImpl } from '../src/odo';
import { TestItem } from './openshift/testOSItem';
import sinon = require('sinon');

const expect = chai.expect;
chai.use(sinonChai);

suite('OpenShift Application Explorer', () => {
    const clusterItem = new TestItem(null, 'cluster');
    const projectItem = new TestItem(clusterItem, 'project');
    const appItem = new TestItem(projectItem, 'application', );
    const serviceItem = new TestItem(appItem, 'service');
    const sandbox = sinon.createSandbox();

    let oseInstance: OpenShiftExplorer;

    setup(() => {
        sandbox.stub(OdoImpl.prototype, 'getClusters').resolves([clusterItem]);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('delegate calls to OpenShiftObject instance', async () => {
        oseInstance = OpenShiftExplorer.getInstance();
        clusterItem.getChildren().push(projectItem);
        projectItem.getChildren().push(appItem);
        appItem.getChildren().push(serviceItem);
        const clusters = await oseInstance.getChildren();
        expect(clusters[0]).equals(clusterItem);
        const services = oseInstance.getChildren(appItem);
        expect(services[0]).equals(serviceItem);
        expect(oseInstance.getParent(appItem)).equals(projectItem);
        expect(oseInstance.getTreeItem(serviceItem)).equals(serviceItem);
    });

});