import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import sinon = require('sinon');
import { OpenShiftItem } from '../../src/openshift/openshiftItem';
import { OdoImpl } from '../../src/odo';
import { TestItem } from './testOSItem';
import { fail } from 'assert';

const expect = chai.expect;
chai.use(sinonChai);

suite('OpenShifItem', () => {

    let sandbox: sinon.SinonSandbox;
    const projectItem = new TestItem(null, 'project');
    const appItem = new TestItem(projectItem, 'application');
    const componentItem = new TestItem(appItem, 'component');
    const serviceItem = new TestItem(appItem, 'service');

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
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

    suite('getApplicationNames', ()=> {

        test('returns an array of application names for the project if there is at least one application', async ()=> {
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([appItem]);
            const appNames = await OpenShiftItem.getApplicationNames(projectItem);
            expect(appNames[0].getName()).equals('application');

        });

        test('throws error if there are no applications available', async ()=> {
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([]);
            try {
                await OpenShiftItem.getApplicationNames(projectItem);
            } catch (err) {
                expect(err.message).equals('You need at least one Application available. Please create new OpenShift Application and try again.');
                return;
            }
            fail('should throw error in case applications array is empty');
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
});