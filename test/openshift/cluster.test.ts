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
import { Cluster } from '../../src/openshift/cluster';
import { OpenShiftExplorer } from '../../src/explorer';
import { CliExitData } from '../../src/cli';

const expect = chai.expect;
chai.use(sinonChai);

suite('Openshift/Cluster', () => {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub, commandStub: sinon.SinonStub, inputStub: sinon.SinonStub,
      infoStub: sinon.SinonStub, loginStub: sinon.SinonStub, quickPickStub: sinon.SinonStub;
    const testData: CliExitData = {
        error: undefined,
        stderr: '',
        stdout: 'output'
    };
    const error = 'FATAL ERROR';
    const errorData: CliExitData = {
        error: undefined,
        stderr: error,
        stdout: 'output'
    };
    const testUrl = 'url';
    const testUser = 'user';
    const password = 'password';
    const token = 'token';

    setup(() => {
        sandbox = sinon.createSandbox();
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves(testData);
        inputStub = sandbox.stub(vscode.window, 'showInputBox');
        commandStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        infoStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves('Yes');
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick').resolves('Credentials');
        loginStub = sandbox.stub(OdoImpl.prototype, 'requireLogin').resolves(true);
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('login', () => {

        setup(() => {
            inputStub.onFirstCall().resolves(testUrl);
            inputStub.onSecondCall().resolves(testUser);
            inputStub.onThirdCall().resolves(password);
        });

        test('returns with no url set', async () => {
            inputStub.onFirstCall().resolves();
            const status = await Cluster.login();

            expect(status).null;
        });

        test('wraps incoming errors', async () => {
            commandStub.rejects(error);

            try {
                await Cluster.login();
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to login to cluster '${testUrl}' with '${error}'!`);
            }
        });

        test('can log the user out if already logged in', async () => {
            loginStub.resolves(false);
            const status = await Cluster.login();

            expect(execStub).calledWith('oc logout');
            expect(status).equals(`Successfully logged in to '${testUrl}'`);
        });

        test('rejects if logout from existing cluster fails', async () => {
            loginStub.resolves(false);
            execStub.resolves(errorData);

            try {
                await Cluster.login();
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to logout of the current cluster with '${error}'!`);
            }
        });

        test('returns if the user refuses to log out of an existing cluster', async () => {
            loginStub.resolves(false);
            infoStub.resolves('No');
            const status = await Cluster.login();

            expect(status).null;
        });

        suite('credentials', () => {
            test('happy path works', async () => {
                const status = await Cluster.login();

                expect(status).equals(`Successfully logged in to '${testUrl}'`);
                expect(execStub).calledOnceWith(`oc login ${testUrl} -u ${testUser} -p ${password}`);
                expect(commandStub).calledOnceWith('setContext', 'isLoggedIn', true);
            });

            test('returns with no username set', async () => {
                inputStub.onSecondCall().resolves();
                const status = await Cluster.login();

                expect(status).null;
            });

            test('returns with no password set', async () => {
                inputStub.onThirdCall().resolves();
                const status = await Cluster.login();

                expect(status).null;
            });

            test('errors if there is output on odo stderr', async () => {
                execStub.resolves(errorData);

                try {
                    await Cluster.login();
                    expect.fail();
                } catch (err) {
                    expect(err).equals(`Failed to login to cluster '${testUrl}' with '${error}'!`);
                }
            });
        });

        suite('token', () => {
            setup(() => {
                quickPickStub.resolves('Token');
                inputStub.onSecondCall().resolves('token');
            });

            test('happy path works', async () => {
                const status = await Cluster.login();

                expect(status).equals(`Successfully logged in to '${testUrl}'`);
                expect(execStub).calledOnceWith(`oc login ${testUrl} --token=${token}`);
                expect(commandStub).calledOnceWith('setContext', 'isLoggedIn', true);
            });

            test('returns with no token set', async () => {
                inputStub.onSecondCall().resolves();
                const status = await Cluster.login();

                expect(status).null;
            });

            test('handles incoming errors the same way as credentials login', async () => {
                execStub.rejects(error);
                try {
                    await Cluster.login();
                    expect.fail();
                } catch (err) {
                    expect(err).equals(`Failed to login to cluster '${testUrl}' with '${error}'!`);
                }
            });
        });
    });

    suite('logout', () => {
        let warnStub: sinon.SinonStub;

        setup(() => {
            warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves('Logout');
        });

        test('simple logout works', async () => {
            infoStub.onFirstCall().resolves('No');
            const status = await Cluster.logout();

            expect(status).null;
            expect(execStub).calledOnceWith('oc logout');
            expect(commandStub).calledOnceWith('setContext', 'isLoggedIn', false);
        });

        test('logout and log back in works', async () => {
            infoStub.onFirstCall().resolves('Yes');
            const logStub: sinon.SinonStub = sandbox.stub(Cluster, 'login').resolves('Logged in');
            const status = await Cluster.logout();

            expect(logStub).calledOnce;
            expect(status).equals('Logged in');
        });

        test('cancel works', async () => {
            warnStub.resolves('Cancel');
            const status = await Cluster.logout();

            expect(status).null;
        });

        test('handles errors from odo', async () => {
            execStub.rejects(error);

            try {
                await Cluster.logout();
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to logout of the current cluster with '${error}'!`);
            }
        });

        test('handles errors from odo stderr', async () => {
            execStub.resolves(errorData);

            try {
                await Cluster.logout();
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to logout of the current cluster with '${errorData.stderr}'!`);
            }
        });

        test('throws errors from subsequent login', async () => {
            execStub.onSecondCall().resolves(errorData);
            infoStub.onFirstCall().resolves('Yes');
            inputStub.onFirstCall().resolves(testUrl);
            inputStub.onSecondCall().resolves(testUser);
            inputStub.onThirdCall().resolves(password);

            try {
                await Cluster.logout();
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to login to cluster '${testUrl}' with '${error}'!`);
            }
        });
    });

    suite('about', () => {
        test('calls the proper odo command in terminal', () => {
            const stub = sandbox.stub(OdoImpl.prototype, 'executeInTerminal');
            Cluster.about();

            expect(stub).calledOnceWith('odo version', process.cwd());
        });
    });

    suite('refresh', () => {
        test('calls refresh on the explorer', () => {
            const stub = sandbox.stub(OpenShiftExplorer.prototype, 'refresh');
            Cluster.refresh();

            expect(stub).calledOnce;
        });
    });
});