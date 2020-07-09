/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import { EventEmitter } from 'events';
import { WatchSessionsView } from '../../src/watch';
import { Component } from '../../src/openshift/component';
import { TestItem } from './openshift/testOSItem';
import { ContextType } from '../../src/odo';

import sinon = require('sinon');

const {expect} = chai;
chai.use(sinonChai);

suite('Watch Sessions View', () => {

    const sandbox = sinon.createSandbox();
    let view: WatchSessionsView;
    let startEmitter: EventEmitter;
    let stopEmitter:  EventEmitter;
    const clusterItem = new TestItem(null, 'cluster', ContextType.CLUSTER);
    const projectItem = new TestItem(clusterItem, 'project', ContextType.PROJECT);
    const appItem = new TestItem(projectItem, 'application', ContextType.APPLICATION);
    const componentItem = new TestItem(appItem, 'component', ContextType.COMPONENT);

    setup(() => {
        sandbox.stub(Component, 'onDidWatchStarted').callsFake((listener) => {
            startEmitter = new EventEmitter();
            startEmitter.on('watchStarted', listener);
        });
        sandbox.stub(Component, 'onDidWatchStopped').callsFake((listener) => {
            stopEmitter = new EventEmitter();
            stopEmitter.on('watchStopped', listener);
        });
         view = new WatchSessionsView();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('adds component to view after watch command executed', async () => {
        startEmitter.emit('watchStarted', componentItem);
        const children = await view.getChildren();
        expect(children.length).equals(1);
    });

    test('removes component from view after stop command executed', async () => {
        startEmitter.emit('watchStarted', componentItem);
        stopEmitter.emit('watchStopped', componentItem);
        const children = await view.getChildren();
        expect(children.length).equals(0);
    });

});
