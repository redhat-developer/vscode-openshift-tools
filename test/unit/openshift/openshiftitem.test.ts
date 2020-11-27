/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import { fail } from 'assert';
import OpenShiftItem from '../../../src/openshift/openshiftItem';
import { OdoImpl, ContextType } from '../../../src/odo';
import { wait } from '../../../src/util/async';
import { TestItem } from './testOSItem';

import sinon = require('sinon');

const {expect} = chai;
chai.use(sinonChai);

suite('OpenShiftItem', () => {

    let sandbox: sinon.SinonSandbox;
    const projectItem = new TestItem(null, 'project', ContextType.PROJECT);
    const appItem = new TestItem(projectItem, 'application', ContextType.APPLICATION);
    const componentItem = new TestItem(appItem, 'component', ContextType.COMPONENT);
    const serviceItem = new TestItem(appItem, 'service', ContextType.SERVICE);
    const storageItem = new TestItem(componentItem, 'storage', ContextType.STORAGE);
    const routeItem = new TestItem(componentItem, 'route', ContextType.COMPONENT_ROUTE);

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Wait eventually exits', async () => {
        return wait();
    });

    suite('getProjectNames', ()=> {

        test('returns an array of application names for the project if there is at least one project', async ()=> {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            const appNames = await OpenShiftItem.getProjectNames();
            expect(appNames[0].getName()).equals('project');

        });

        test('throws error if there are no projects available', async ()=> {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([]);
            try {
                await OpenShiftItem.getProjectNames();
            } catch (err) {
                expect(err.message).equals('You need at least one Project available. Please create new OpenShift Project and try again.');
                return;
            }
            fail('should throw error in case projects array is empty');
        });
    });

    suite('validateMatches', ()=> {

        test('returns validation message if provided value is not in lower case alphanumeric characters or "-"', ()=> {
            const message = 'Not a valid Application name. Please use lower case alphanumeric characters or "-", start with an alphabetic character, and end with an alphanumeric character';
            let appNames = OpenShiftItem.validateMatches(message, 'Nodejs-app');
            expect(appNames).equals(message);
            appNames = OpenShiftItem.validateMatches(message, '2nodejs-app');
            expect(appNames).equals(message);
        });

        test('returns undefined if provided value is in lower case alphanumeric characters', ()=> {
            const validateMatches = OpenShiftItem.validateMatches(undefined, 'nodejs-app');
            expect(validateMatches).equals(null);
        });
    });

    suite('getApplicationNames', ()=> {

        test('returns an array of application names for the project if there is at least one application', async ()=> {
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([appItem]);
            const appNames = await OpenShiftItem.getApplicationNames(projectItem, false);
            expect(appNames[0].getName()).equals('application');
        });

        test('shows item to create new application in QuickPick if no application available', async ()=> {
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([appItem]);
            sandbox.stub(OpenShiftItem, 'getName').resolves();
            const appNames = await OpenShiftItem.getApplicationNames(projectItem, true);
            expect(appNames[0].label).equals('$(plus) Create new Application...');
        });

        test('throws error if there are no application available', async ()=> {
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([]);
            try {
                await OpenShiftItem.getApplicationNames(appItem, false);
            } catch (err) {
                expect(err.message).equals('You need at least one Component available. Please create new OpenShift Component and try again.');
                return;
            }
            fail('should throw error in case components array is empty');
        });

    });

    suite('getComponentNames', ()=> {

        test('returns an array of component names for the application if there is at least one component', async ()=> {
            sandbox.stub(OdoImpl.prototype, 'getComponents').resolves([componentItem]);
            const componentNames = await OpenShiftItem.getComponentNames(appItem);
            expect(componentNames[0].getName()).equals('component');

        });

        test('throws error if there are no components available', async ()=> {
            sandbox.stub(OdoImpl.prototype, 'getComponents').resolves([]);
            try {
                await OpenShiftItem.getComponentNames(projectItem);
            } catch (err) {
                expect(err.message).equals('You need at least one Component available. Please create new OpenShift Component and try again.');
                return;
            }
            fail('should throw error in case components array is empty');
        });
    });

    suite('getServiceNames', ()=> {

        test('returns an array of service names for the application if there is at least one component', async ()=> {
            sandbox.stub(OdoImpl.prototype, 'getServices').resolves([serviceItem]);
            const serviceNames = await OpenShiftItem.getServiceNames(appItem);
            expect(serviceNames[0].getName()).equals('service');

        });

        test('throws error if there are no components available', async ()=> {
            sandbox.stub(OdoImpl.prototype, 'getServices').resolves([]);
            try {
                await OpenShiftItem.getServiceNames(appItem);
            } catch (err) {
                expect(err.message).equals('You need at least one Service available. Please create new OpenShift Service and try again.');
                return;
            }
            fail('should throw error in case components array is empty');
        });
    });

    suite('getStorageNames', ()=> {

        test('returns an array of storage names for the component if there is at least one component', async ()=> {
            sandbox.stub(OdoImpl.prototype, 'getStorageNames').resolves([storageItem]);
            const storageNames = await OpenShiftItem.getStorageNames(componentItem);
            expect(storageNames[0].getName()).equals('storage');

        });

        test('throws error if there are no components available', async ()=> {
            sandbox.stub(OdoImpl.prototype, 'getStorageNames').resolves([]);
            try {
                await OpenShiftItem.getStorageNames(componentItem);
            } catch (err) {
                expect(err.message).equals('You need at least one Storage available. Please create new OpenShift Storage and try again.');
                return;
            }
            fail('should throw error in case components array is empty');
        });
    });

    suite('getRoutes', ()=> {

        test('returns list of URL names for the component if there is at least one component', async ()=> {
            sandbox.stub(OdoImpl.prototype, 'getRoutes').resolves([routeItem]);
            const routeNames = await OpenShiftItem.getRoutes(componentItem);
            expect(routeNames[0].getName()).equals('route');

        });

        test('throws error if there are no components available', async ()=> {
            sandbox.stub(OdoImpl.prototype, 'getRoutes').resolves([]);
            try {
                await OpenShiftItem.getRoutes(componentItem);
            } catch (err) {
                expect(err.message).equals('You need to add one URL to the component. Please create a new URL and try again.');
                return;
            }
            fail('should throw error in case components array is empty');
        });
    });
});
