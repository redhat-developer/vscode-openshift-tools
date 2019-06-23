/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl, Command } from '../../src/odo';
import { Cluster } from '../../src/openshift/cluster';
import { OpenShiftExplorer } from '../../src/explorer';
import { CliExitData } from '../../src/cli';
import { TestItem } from './testOSItem';
import { OpenShiftItem } from '../../src/openshift/openshiftItem';
import pq = require('proxyquire');
import { getVscodeModule } from '../../src/util/credentialManager';

const expect = chai.expect;
chai.use(sinonChai);

const keytar: any = getVscodeModule('keytar');

suite('Openshift/Cluster', () => {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub, commandStub: sinon.SinonStub, inputStub: sinon.SinonStub,
        quickPickItemStub: sinon.SinonStub,
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
    const testUrl = 'https://162.165.64.43:8443';
    const testUser = 'user';
    const password = 'password';
    const token = 'token';
    const projectItem = new TestItem(null, 'project');
    const appItem = new TestItem(projectItem, 'application');

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(keytar);
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves(testData);
        inputStub = sandbox.stub(vscode.window, 'showInputBox');
        commandStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        infoStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves('Yes');
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick').resolves('Credentials');
        loginStub = sandbox.stub(OdoImpl.prototype, 'requireLogin').resolves(true);
        sandbox.stub(OpenShiftItem, 'getProjectNames').resolves([projectItem]);
        sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('login', () => {

        setup(() => {
            quickPickStub.onFirstCall().resolves({description: "Current Context", label: testUrl});
            quickPickStub.onSecondCall().resolves({description: "Current Context", label: testUser});
        });

        test('exits if login confirmation declined', async () => {
            infoStub.resolves('No');
            loginStub.resolves(false);
            const status = await Cluster.login();

            expect(status).null;
        });

        test('wraps incoming errors', async () => {
            quickPickStub.resolves('Credentials');
            quickPickStub.onSecondCall().resolves({description: "Current Context", label: testUrl});
            quickPickStub.onThirdCall().resolves({description: "Current Context", label: testUser});
            inputStub.resolves(password);
            commandStub.rejects(error);

            try {
                await Cluster.login();
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to login to cluster '${testUrl}' with '${error}'!`);
            }
        });

        test('exits if the user refuses to log out of an existing cluster', async () => {
            loginStub.resolves(false);
            infoStub.resolves('No');
            const status = await Cluster.login();
            expect(status).null;
        });

        test('exits if the user refuses to select the way to log in to the cluster', async () => {
            loginStub.resolves('Yes');
            quickPickStub.resolves(undefined);
            const status = await Cluster.login();
            expect(status).null;
        });

        suite('credentials', () => {

            setup(() => {
                inputStub.resolves(password);
            });

            test('logins to new cluster if user answer yes to a warning', async () => {
                loginStub.resolves(false);
                infoStub.resolves('Yes');
                const result = await Cluster.credentialsLogin();
                expect(result).equals(`Successfully logged in to '${testUrl}'`);
            });

            test('exits if the user cancels url input box', async () => {
                loginStub.resolves(false);
                inputStub.onFirstCall().resolves(null);
                const result = await Cluster.credentialsLogin();
                expect(result).null;
            });

            test('exits if the user refuses to login to new cluster', async () => {
                loginStub.resolves(false);
                infoStub.resolves('No');
                const result = await Cluster.credentialsLogin();
                expect(result).null;
            });

            test('happy path works', async () => {
                const status = await Cluster.credentialsLogin();

                expect(status).equals(`Successfully logged in to '${testUrl}'`);
                expect(execStub).calledOnceWith(Command.odoLoginWithUsernamePassword(testUrl, testUser, password));
                expect(commandStub).calledOnceWith('setContext', 'isLoggedIn', true);
            });

            (keytar ? test : test.skip)('returns with no username set', async () => {
                quickPickStub.onSecondCall().resolves({description: "Current Context", label: undefined});
                const status = await Cluster.credentialsLogin();

                expect(status).null;
            });

            test('returns with no password set', async () => {
                inputStub.resolves();
                const status = await Cluster.credentialsLogin();

                expect(status).null;
            });

            test('errors if there is output on odo stderr', async () => {
                execStub.resolves(errorData);

                try {
                    await Cluster.credentialsLogin();
                    expect.fail();
                } catch (err) {
                    expect(err).equals(`Failed to login to cluster '${testUrl}' with '${error}'!`);
                }
            });

            test('checks cluster url name is valid url', async () => {
                let result: string | Thenable<string>;
                quickPickStub.onFirstCall().resolves({description: "Current Context", label: `$(plus) Provide new URL...`});
                inputStub.onFirstCall().callsFake((options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> => {
                    result = options.validateInput('http://127.0.0.1:9999');
                    return Promise.resolve('http://127.0.0.1:9999');
                });
                await Cluster.credentialsLogin();
                expect(result).is.null;
            });

            test('checks user name is not empty', async () => {
                let result: string | Thenable<string>;
                quickPickStub.onFirstCall().resolves({description: "Current Context", label: testUrl});
                quickPickStub.onSecondCall().resolves({description: "Current Context", label: `$(plus) Add new user...`});
                inputStub.onFirstCall().callsFake((options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> => {
                    result = options.validateInput('goodvalue');
                    return Promise.resolve('goodvalue');
                });
                await Cluster.credentialsLogin();
                expect(result).is.null;
            });
        });

        suite('token', () => {
            setup(() => {
                sandbox.stub(vscode.env.clipboard, 'readText').resolves('oc login https://162.165.64.43:8443 --token=bX6eP0d4IRgXwWuCKq2856h5fyK9c2U5tOKCwFeEmQA');
                quickPickStub.resolves('Token');
                inputStub.resolves('token');
            });

            test('logins to new cluster if user answer yes to a warning', async () => {
                loginStub.resolves(false);
                infoStub.resolves('Yes');
                const result = await Cluster.tokenLogin();
                expect(result).equals(`Successfully logged in to '${testUrl}'`);
            });

            test('exits if the user cancels url input box', async () => {
                loginStub.resolves(false);
                inputStub.onFirstCall().resolves(null);
                const result = await Cluster.tokenLogin();
                expect(result).null;
            });

            test('exits if the user refuses to login to new cluster', async () => {
                loginStub.resolves(false);
                infoStub.resolves('No');
                const result = await Cluster.tokenLogin();
                expect(result).null;
            });

            test('happy path works', async () => {
                const status = await Cluster.tokenLogin();

                expect(status).equals(`Successfully logged in to '${testUrl}'`);
                expect(execStub).calledOnceWith(Command.odoLoginWithToken(testUrl, token));
                expect(commandStub).calledOnceWith('setContext', 'isLoggedIn', true);
            });

            test('returns with no url set', async () => {
                quickPickStub.onFirstCall().resolves({description: "Current Context", label: undefined});
                const status = await Cluster.tokenLogin();

                expect(status).null;
            });

            test('returns with no token set', async () => {
                inputStub.onFirstCall().resolves();
                const status = await Cluster.tokenLogin();

                expect(status).null;
            });

            test('handles incoming errors the same way as credentials login', async () => {
                execStub.rejects(error);
                try {
                    await Cluster.tokenLogin();
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
            expect(execStub).calledOnceWith('odo logout');
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
            infoStub.resolves('Yes');
            quickPickStub.onFirstCall().resolves('Credentials');
            quickPickStub.onSecondCall().resolves({description: "Current Context", label: testUrl});
            quickPickStub.onThirdCall().resolves({description: "Current Context", label: testUrl});
            inputStub.resolves(password);

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

            expect(stub).calledOnceWith(Command.printOdoVersion());
        });
    });

    suite('refresh', () => {
        test('calls refresh on the explorer', () => {
            const stub = sandbox.stub(OpenShiftExplorer.prototype, 'refresh');
            Cluster.refresh();

            expect(stub).calledOnce;
        });
    });

    suite('open console', () => {
        const openStub: sinon.SinonStub = sinon.stub();
        let clusterMock;
        setup(() => {
            clusterMock = pq('../../src/openshift/cluster', {
                open: openStub
            }).Cluster;
        });

        test('opens URL from cluster\'s tree item label if called from cluster\'s context menu', () => {
            const cluster = new TestItem(null, 'http://localhost');
            clusterMock.openshiftConsole(cluster);
            openStub.calledOnceWith('http://localhost');
        });

        test('opens URL from first cluster label', () => {
            const cluster = new TestItem(null, 'http://localhost');
            sandbox.stub(OdoImpl.prototype, 'getClusters').resolves([cluster]);
            clusterMock.openshiftConsole();
            openStub.calledOnceWith('http://localhost');
        });

        test('shows error message if node label is not URL', () => {
            const cluster = new TestItem(null, 'localhost');
            sandbox.stub(OdoImpl.prototype, 'getClusters').resolves([cluster]);
            const errMsgStub = sandbox.stub(vscode.window, 'showErrorMessage');
            clusterMock.openshiftConsole();
            errMsgStub.calledOnceWith('localhost', undefined);
        });

    });
});
