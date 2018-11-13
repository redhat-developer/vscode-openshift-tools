/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl } from '../../src/odo';
import { Application } from '../../src/openshift/application';
import { TestItem } from './testOSItem';

const expect = chai.expect;
chai.use(sinonChai);

suite('Openshift/Application', () => {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    const projectItem = new TestItem(null, 'project');
    const appItem = new TestItem(projectItem, 'app');

    setup(() => {
        sandbox = sinon.createSandbox();
        execStub = sandbox.stub(OdoImpl.prototype, 'execute');
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create', () => {
        let inputStub: sinon.SinonStub;

        setup(() => {
            inputStub = sandbox.stub(vscode.window, 'showInputBox');
        });

        test('calls the appropriate odo command', async () => {
            inputStub.resolves('name');
            execStub.resolves();

            await Application.create(projectItem);

            expect(execStub).calledOnceWith(`odo project set ${projectItem.getName()} && odo app create name`);
        });

        test('returns status when successful', async () => {
            inputStub.resolves('name1');
            execStub.resolves();

            const result = await Application.create(projectItem);

            expect(result).equals(`Application 'name1' successfully created`);
        });

        test('returns null with no input', async() => {
            inputStub.resolves();

            const result = await Application.create(projectItem);

            expect(result).null;
        });

        test('wraps error messages with additional info', async () => {
            inputStub.resolves('name1');
            execStub.rejects('ERROR');

            try {
                await Application.create(projectItem);
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to create application with error 'ERROR'`);
            }
        });
    });

    suite('describe', () => {
        let termStub: sinon.SinonStub;

        setup(() => {
            termStub = sandbox.stub(OdoImpl.prototype, 'executeInTerminal').resolves();
        });

        test('calls the appropriate odo command in terminal', () => {
            Application.describe(appItem);

            expect(termStub).calledOnceWith(`odo project set ${projectItem.getName()} && odo app describe ${appItem.getName()}`, process.cwd());
        });
    });

    suite('del', () => {
        let warnStub: sinon.SinonStub;

        setup(() => {
            warnStub = sandbox.stub(vscode.window, 'showWarningMessage');
        });

        test('calls the appropriate odo command if confirmed', async () => {
            warnStub.resolves('Yes');
            execStub.resolves();

            await Application.del(appItem);

            expect(execStub).calledOnceWith(`odo project set ${projectItem.getName()} && odo app delete ${appItem.getName()} -f`);
        });

        test('returns status when successful', async () => {
            warnStub.resolves('Yes');
            execStub.resolves();

            const result = await Application.del(appItem);

            expect(result).equals(`Application '${appItem.getName()}' successfully deleted`);
        });

        test('returns null when cancelled', async() => {
            warnStub.resolves('Cancel');

            const result = await Application.del(appItem);

            expect(result).null;
        });

        test('wraps error messages with additional info', async () => {
            warnStub.resolves('Yes');
            execStub.rejects('ERROR');

            try {
                await Application.del(appItem);
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to delete application with error 'ERROR'`);
            }
        });
    });
});