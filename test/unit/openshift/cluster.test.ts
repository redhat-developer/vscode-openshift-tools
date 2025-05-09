/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as vscode from 'vscode';
import { CliChannel } from '../../../src/cli';
import { OpenShiftExplorer } from '../../../src/explorer';
import { Oc } from '../../../src/oc/ocWrapper';
import { Command } from '../../../src/odo/command';
import { Odo } from '../../../src/odo/odoWrapper';
import { Cluster } from '../../../src/openshift/cluster';
import { CliExitData } from '../../../src/util/childProcessUtil';
import { TokenStore } from '../../../src/util/credentialManager';
import { LoginUtil } from '../../../src/util/loginUtil';
import { OpenShiftTerminalManager } from '../../../src/webview/openshift-terminal/openShiftTerminal';

const {expect} = chai;
chai.use(sinonChai);

suite('Openshift/Cluster', function() {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    let commandStub: sinon.SinonSpy;
    let inputStub: sinon.SinonStub;
    let infoStub: sinon.SinonStub;
    let requireLoginStub: sinon.SinonStub;
    let quickPickStub: sinon.SinonStub;
    let passwordLoginStub: sinon.SinonStub;
    let tokenLoginStub: sinon.SinonStub;
    let logoutStub: sinon.SinonStub;

    const testData: CliExitData = {
        error: undefined,
        stderr: '',
        stdout: 'https://localhost'
    };

    const fatalErrorText = 'FATAL ERROR';
    const errorData: CliExitData = {
        error: {
            code: 1,
            name: 'Error',
            message: 'FATAL ERROR'
        },
        stderr: fatalErrorText,
        stdout: 'output'
    };
    const testUrl = 'https://162.165.64.43:8443';
    const testUser = 'user';
    const password = 'password';
    const token = 'token';

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(TokenStore.extensionContext.secrets);
        execStub = sandbox.stub(Odo.prototype, 'execute').resolves(testData);
        inputStub = sandbox.stub(vscode.window, 'showInputBox');
        commandStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        infoStub = sandbox.stub<any, any>(vscode.window, 'showInformationMessage').resolves('Yes');
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick').resolves({label: 'Credentials', description: 'Log in to the given server using credentials'});
        requireLoginStub = sandbox.stub(LoginUtil.prototype, 'requireLogin').resolves(true);
        passwordLoginStub = sandbox.stub(Oc.prototype, 'loginWithUsernamePassword').resolves();
        tokenLoginStub = sandbox.stub(Oc.prototype, 'loginWithToken').resolves();
        logoutStub = sandbox.stub(LoginUtil.prototype, 'logout').resolves();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite.skip('login', () => {

        setup(() => {
            quickPickStub.onFirstCall().resolves({description: 'Current Context', label: testUrl});
            quickPickStub.onSecondCall().resolves({description: 'Current Context', label: testUser});
        });

        test('exits if login confirmation declined', async () => {
            infoStub.resolves('No');
            requireLoginStub.resolves(false);
            const status = await Cluster.login();

            expect(status).null;
        });

        test('returns null if loginActions is not selected', async () => {
            infoStub.resolves('Yes');
            quickPickStub.onFirstCall().resolves(null);
            const status = await Cluster.login();

            expect(status).null;
        });

        test('wraps incoming errors', async () => {
            quickPickStub.resolves('Credentials');
            quickPickStub.onSecondCall().resolves({description: 'Current Context', label: testUrl});
            quickPickStub.onThirdCall().resolves({description: 'Current Context', label: testUser});
            inputStub.resolves(password);
            const fatalError = new Error(fatalErrorText);
            execStub.rejects(fatalError);
            let expectedErr: { message: any };
            try {
                await Cluster.login();
            } catch (error) {
                expectedErr = error;
            }
            expect(expectedErr.message).equals(`Failed to login to cluster '${testUrl}' with '${fatalError.message}'!`);
        });

        test('exits if the user refuses to log out of an existing cluster', async () => {
            requireLoginStub.resolves(false);
            infoStub.resolves('No');
            const status = await Cluster.login();
            expect(status).null;
        });

        test('exits if the user refuses to select the way to log in to the cluster', async () => {
            requireLoginStub.resolves('Yes');
            quickPickStub.resolves(undefined);
            const status = await Cluster.login();
            expect(status).null;
        });

        suite('credentials', () => {

            setup(() => {
                inputStub.resolves(password);
            });

            test('logins to new cluster if user answer yes to a warning', async () => {
                requireLoginStub.resolves(false);
                infoStub.resolves('Yes');
                const result = await Cluster.credentialsLogin(testUrl, false);
                expect(result).equals(`Successfully logged in to '${testUrl}'`);
            });

            test('returns null if cluster url is not provided', async () => {
                infoStub.resolves('Yes');
                quickPickStub.onFirstCall().resolves(null);
                const result = await Cluster.credentialsLogin(null);
                expect(result).null;
            });

            test('returns null if username is not provided', async () => {
                infoStub.resolves('Yes');
                quickPickStub.onFirstCall().resolves(null);
                const result = await Cluster.credentialsLogin(null);
                expect(result).null;
            });

            test('doesn\'t ask to save password if old and new passwords are the same', async () => {
                infoStub.resolves('Yes');
                sandbox.stub(TokenStore, 'getItem').resolves(password);
                const result = await Cluster.credentialsLogin(testUrl, false);
                expect(result).equals(`Successfully logged in to '${testUrl}'`);
            });

            test('exits if the user cancels url input box', async () => {
                requireLoginStub.resolves(false);
                inputStub.onFirstCall().resolves(null);
                const result = await Cluster.credentialsLogin(null);
                expect(result).null;
            });

            test('exits if the user refuses to login to new cluster', async () => {
                requireLoginStub.resolves(false);
                infoStub.resolves('No');
                const result = await Cluster.credentialsLogin(null);
                expect(result).null;
            });

            test('happy path works', async () => {
                infoStub.resolves('No');
                quickPickStub.onFirstCall().resolves({label: testUser});
                quickPickStub.onSecondCall().resolves({label: 'Credentials'});
                inputStub.resolves('password');
                const status = await Cluster.credentialsLogin(testUrl, false);

                expect(status).equals(`Successfully logged in to '${testUrl}'`);
                expect(passwordLoginStub).calledOnceWith(testUrl, testUser, password);
                expect(commandStub).calledWith('setContext', 'isLoggedIn', true);
            });

            test('returns with no username set', async () => {
                quickPickStub.onSecondCall().resolves({description: 'Current Context', label: undefined});
                const status = await Cluster.credentialsLogin();

                expect(status).null;
            });

            test('returns with no password set', async () => {
                inputStub.resolves();
                const status = await Cluster.credentialsLogin(null);

                expect(status).null;
            });

            test('errors if there is output on odo stderr', async () => {
                execStub.resolves(errorData);
                let expectedErr: { message: any };
                try {
                    await Cluster.credentialsLogin(undefined, true);
                } catch (err) {
                    expectedErr = err;
                }
                expect(expectedErr.message).equals(`Failed to login to cluster '${testUrl}' with '${fatalErrorText}'!`);
            });

            test('checks cluster url name is valid url', async () => {
                let result;
                quickPickStub.onFirstCall().resolves({description: 'Current Context', label: '$(plus) Provide new URL...'});
                inputStub.onFirstCall().callsFake((options?: vscode.InputBoxOptions): Thenable<string> => {
                    result = options.validateInput('http://127.0.0.1:9999');
                    return Promise.resolve('http://127.0.0.1:9999');
                });
                await Cluster.login();
                expect(result).is.null;
            });

            test('checks user name is not empty', async () => {
                let result;
                quickPickStub.onFirstCall().resolves({description: 'Current Context', label: testUrl});
                quickPickStub.onSecondCall().resolves({label: 'Credentials'});
                quickPickStub.onThirdCall().resolves({description: 'Current Context', label: '$(plus) Add new user...'});
                inputStub.onFirstCall().callsFake((options?: vscode.InputBoxOptions): Thenable<string> => {
                    result = options.validateInput('goodvalue');
                    return Promise.resolve('goodvalue');
                });
                await Cluster.login();
                expect(result).is.null;
            });
        });

        suite('token', () => {
            setup(() => {
                sandbox.stub(Cluster, 'readFromClipboard').resolves('oc login https://162.165.64.43:8443 --token=bX6eP0d4IRgXwWuCKq2856h5fyK9c2U5tOKCwFeEmQA');
                quickPickStub.resolves({label: 'Token', description: 'Log in to the given server using bearer token'});
                inputStub.resolves('token');
            });

            test('logins to new cluster if user answer yes to a warning', async () => {
                requireLoginStub.resolves(false);
                infoStub.resolves('Yes');
                const result = await Cluster.tokenLogin(testUrl);
                expect(result).equals(`Successfully logged in to '${testUrl}'`);
            });

            test('exits if the user cancels url input box', async () => {
                requireLoginStub.resolves(false);
                inputStub.onFirstCall().resolves(null);
                const result = await Cluster.tokenLogin(testUrl);
                expect(result).null;
            });

            test('exits if the user refuses to login to new cluster', async () => {
                requireLoginStub.resolves(false);
                infoStub.resolves('No');
                const result = await Cluster.tokenLogin(null);
                expect(result).null;
            });

            test('happy path works', async () => {
                const status = await Cluster.tokenLogin(testUrl);

                expect(status).equals(`Successfully logged in to '${testUrl}'`);
                expect(tokenLoginStub).calledOnceWith(testUrl, token)
                expect(commandStub).calledWith('setContext', 'isLoggedIn', true);
            });

            test('returns with no token set', async () => {
                inputStub.onFirstCall().resolves();
                const status = await Cluster.tokenLogin(testUrl);

                expect(status).null;
            });

            test('handles incoming errors the same way as credentials login', async () => {
                const fatalError = new Error(fatalErrorText);
                execStub.rejects(fatalError);
                let expectedErr: { message: any };
                try {
                    await Cluster.tokenLogin(testUrl);
                } catch (error) {
                    expectedErr = error;
                }
                expect(expectedErr.message).equals(`Failed to login to cluster '${testUrl}' with '${fatalError.message}'!`);
            });
        });
    });

    suite.skip('logout', () => {
        let warnStub: sinon.SinonStub;

        setup(() => {
            warnStub = sandbox.stub(vscode.window, 'showWarningMessage');
        });

        test('simple logout works', async () => {
            warnStub.onFirstCall().resolves('Logout');
            infoStub.onFirstCall().resolves('No');
            const status = await Cluster.logout();

            expect(status).null;
            expect(logoutStub).calledOnce;
            expect(commandStub).calledWith('setContext', 'isLoggedIn', false);
        });

        test('logout and log back in works', async () => {
            warnStub.onFirstCall().resolves('Logout');
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
            warnStub.onFirstCall().resolves('Logout');
            execStub.rejects(fatalErrorText);
            let expectedErr: any;
            try {
                await Cluster.logout();

            } catch (err) {
                expectedErr = err;
            }
            expect(expectedErr.message).equals(`Failed to logout of the current cluster with '${fatalErrorText}'!`);
        });

        test('handles errors from odo stderr', async () => {
            warnStub.onFirstCall().resolves('Logout');
            execStub.resolves(errorData);
            let expectedErr: any;
            try {
                await Cluster.logout();
            } catch (err) {
                expectedErr = err;
            }
            expect(expectedErr.message).equals(`Failed to logout of the current cluster with '${errorData.stderr}'!`);
        });

        test('throws errors from subsequent login', async () => {
            sandbox.stub(TokenStore, 'getUserName');
            sandbox.stub(TokenStore, 'setItem');
            execStub.onSecondCall().rejects({message: 'FATAL ERROR'});
            warnStub.onFirstCall().resolves('Logout');
            infoStub.resolves('Yes');
            quickPickStub.onFirstCall().resolves({description: 'Current Context', label: testUrl});
            quickPickStub.onSecondCall().resolves({label: 'Credentials'});
            quickPickStub.onThirdCall().resolves({description: 'Current Context', label: 'username'});
            inputStub.resolves(password);
            let expectedErr: { message: any };
            try {
                await Cluster.logout();
            } catch (err) {
                expectedErr = err;
            }
            expect(expectedErr.message).equals(`Failed to login to cluster '${testUrl}' with '${fatalErrorText}'!`);
        });
    });

    suite('about', () => {
        test('calls the proper odo command in terminal', () => {
            const stub = sandbox.stub(OpenShiftTerminalManager.prototype, 'executeInTerminal');
            void Cluster.about();

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

    suite.skip('switchContext', () => {
        const choice = {
            label: 'minishift'
        };
        setup(() => {
            execStub.onFirstCall().resolves();
        });

        test('changes cluster\'s context', async () => {
            quickPickStub.onFirstCall().resolves(choice);
            const result = await Cluster.switchContext();
            expect(result).equals(`Cluster context is changed to: ${choice.label}`);
        });

        test('returns null if OpenShift context is not selected', async () => {
            quickPickStub.onFirstCall().resolves(null);
            const result = await Cluster.switchContext();
            expect(result).null;
        });
    });

    suite('open console', function () {
        const CLUSTER_NAME = 'http://localhost:6443';
        const CONSOLE_URL = 'http://localhost:6443/console';

        let cliExecStub: sinon.SinonStub;

        setup(function() {
            cliExecStub = sandbox.stub(CliChannel.getInstance(), 'executeTool');
        });

        test('opens URL on OpenShift cluster', async function() {
            cliExecStub.callsFake(() =>
                ({ stdout: JSON.stringify({data: {consoleURL: CONSOLE_URL}}) })
            );
            await Cluster.openOpenshiftConsole();
            commandStub.calledOnceWith('vscode.open', vscode.Uri.parse(CONSOLE_URL));
        });

        test('opens URL on non-OpenShift cluster', async function() {
            let counter = 0;
            cliExecStub.callsFake(() => {
                if (counter === 0) {
                    counter ++;
                    throw new Error();
                }
                return { stdout: CLUSTER_NAME };
            });
            await Cluster.openOpenshiftConsole();
            commandStub.calledOnceWith('vscode.open', vscode.Uri.parse(CONSOLE_URL));
        });

    });
});
