/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { TestItem } from './testOSItem';
import { OdoImpl } from '../../src/odo';
import { Url } from '../../src/openshift/url';

const expect = chai.expect;
chai.use(sinonChai);

suite('Openshift/URL', () => {
    let sandbox: sinon.SinonSandbox;
    let quickPickStub: sinon.SinonStub;
    let execStub: sinon.SinonStub;
    const projectItem = new TestItem(null, 'project');
    const appItem = new TestItem(projectItem, 'app');
    const componentItem = new TestItem(appItem, 'component');

    setup(() => {
        sandbox = sinon.createSandbox();
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create Url with no context', () => {

        setup(() => {
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(componentItem);
        });

        teardown(() => {
            sandbox.restore();
        });

        test('calls the appropriate error message if no project found', async () => {
            quickPickStub.restore();
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([]);
            sandbox.stub(vscode.window, 'showErrorMessage');
            try {
                await Url.create(null);
            } catch (err) {
                expect(err.message).equals('You need at least one Project available to create an Url. Please create new OpenShift Project and try again.');
                return;
            }
            expect.fail();
        });

        test('asks to select port if more that one exposed and returns message', async () => {
            execStub = sandbox.stub(OdoImpl.prototype, 'execute');
            execStub.resolves({error: null, stdout: 'port1,', stderr: ''});
            quickPickStub.resolves('port1');
            const result = await Url.create(null);

            expect(result).equals(`URL for component '${componentItem.getName()}' successfully created`);
            expect(execStub).callCount(4);
        });

        test('rejects when fails to create Url', () => {
            execStub = sandbox.stub(OdoImpl.prototype, 'execute');
            execStub.resolves({error: null, stdout: 'port1,', stderr: ''});
            execStub.onFirstCall().rejects();

            return Url.create(null).catch((err) => {
                expect(err).equals(`Failed to create URL for component '${componentItem.getName()}'`);
            });
        });

    });

    suite('create', () => {

        test('asks to select port if more that one exposed and returns message', async () => {
            execStub = sandbox.stub(OdoImpl.prototype, 'execute');
            execStub.onFirstCall().resolves({error: null, stdout: 'port1,port2,port3,', stderr: ''});
            execStub.onSecondCall().resolves();
            quickPickStub.resolves('port1');
            const result = await Url.create(componentItem);

            expect(result).equals(`URL for component '${componentItem.getName()}' successfully created`);
            expect(execStub).calledTwice;
        });

        test('rejects when fails to create Url', () => {
            execStub = sandbox.stub(OdoImpl.prototype, 'execute');
            execStub.onFirstCall().resolves({error: null, stdout: 'port1,', stderr: ''});
            execStub.onSecondCall().rejects();

            return Url.create(componentItem).catch((err) => {
                expect(err).equals(`Failed to create URL for component '${componentItem.getName()}'`);
            });
        });

        test('rejects when component has no ports declared', () => {
            execStub = sandbox.stub(OdoImpl.prototype, 'execute');
            execStub.onFirstCall().resolves({error: null, stdout: '', stderr: ''});
            execStub.onSecondCall().rejects();

            return Url.create(componentItem).catch((err) => {
                expect(err).equals(`Component '${componentItem.getName()}' has no ports decalred.`);
            });
        });
    });
});