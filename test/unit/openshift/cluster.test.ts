/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl, Command, ContextType } from '../../../src/odo';
import { Cluster } from '../../../src/openshift/cluster';
import { OpenShiftExplorer } from '../../../src/explorer';
import { CliExitData } from '../../../src/cli';
import { TestItem } from './testOSItem';
import { OpenShiftItem } from '../../../src/openshift/openshiftItem';
import { getVscodeModule, TokenStore } from '../../../src/util/credentialManager';

import pq = require('proxyquire');

const {expect} = chai;
chai.use(sinonChai);

const keytar: any = getVscodeModule('keytar');

suite('Openshift/Cluster', () => {
    let sandbox: sinon.SinonSandbox;
        let execStub: sinon.SinonStub;
        let commandStub: sinon.SinonStub;
        let inputStub: sinon.SinonStub;
        let infoStub: sinon.SinonStub;
        let loginStub: sinon.SinonStub;
        let quickPickStub: sinon.SinonStub;

    const testData: CliExitData = {
        error: undefined,
        stderr: '',
        stdout: 'output'
    };

    const fatalErrorText = 'FATAL ERROR';
    const fatalError = new Error(fatalErrorText);
    const errorData: CliExitData = {
        error: undefined,
        stderr: fatalErrorText,
        stdout: 'output'
    };
    const routeObj = `{
        "apiVersion": "v1",
        "items": [
            {
                "apiVersion": "route.openshift.io/v1",
                "kind": "Route",
                "spec": {
                    "host": "console-openshift-console.apps-crc.testing",
                    "port": {
                        "targetPort": "https"
                    },
                    "wildcardPolicy": "None"
                }
            }
        ],
        "kind": "List",
        "metadata": {
            "resourceVersion": "",
            "selfLink": ""
        }
    }`;
    const testUrl = 'https://162.165.64.43:8443';
    const testUser = 'user';
    const password = 'password';
    const token = 'token';
    const projectItem = new TestItem(null, 'project', ContextType.PROJECT);
    const appItem = new TestItem(projectItem, 'application', ContextType.APPLICATION);

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(keytar);
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves(testData);
        inputStub = sandbox.stub(vscode.window, 'showInputBox');
        commandStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        infoStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves('Yes');
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick').resolves({label: 'Credentials', description: 'Log in to the given server using credentials'});
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

        test('returns null if loginActions is not selected', async () => {
            infoStub.resolves('Yes');
            quickPickStub.onFirstCall().resolves(null);
            const status = await Cluster.login();

            expect(status).null;
        });

        test('wraps incoming errors', async () => {
            quickPickStub.resolves('Credentials');
            quickPickStub.onSecondCall().resolves({description: "Current Context", label: testUrl});
            quickPickStub.onThirdCall().resolves({description: "Current Context", label: testUser});
            inputStub.resolves(password);
            commandStub.rejects(fatalError);
            let expectedErr: { message: any };
            try {
                await Cluster.login();
            } catch (error) {
                expectedErr = error;
            }
            expect(expectedErr.message).equals(`Failed to login to cluster '${testUrl}' with '${fatalError.message}'!`);
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

            test('returns null if cluster url is not provided', async () => {
                infoStub.resolves('Yes');
                quickPickStub.onFirstCall().resolves(null);
                const result = await Cluster.credentialsLogin();
                expect(result).null;
            });

            test('returns null if username is not provided', async () => {
                infoStub.resolves('Yes');
                quickPickStub.onSecondCall().resolves(null);
                const result = await Cluster.credentialsLogin();
                expect(result).null;
            });

            test("doesn't ask to save password if old and new passwords are the same", async () => {
                infoStub.resolves('Yes');
                sandbox.stub(TokenStore, 'getItem').resolves(password);
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
                let expectedErr: { message: any };
                try {
                    await Cluster.credentialsLogin();
                } catch (err) {
                    expectedErr = err;
                }
                expect(expectedErr.message).equals(`Failed to login to cluster '${testUrl}' with '${fatalErrorText}'!`);
            });

            test('checks cluster url name is valid url', async () => {
                let result: string | Thenable<string>;
                quickPickStub.onFirstCall().resolves({description: "Current Context", label: `$(plus) Provide new URL...`});
                inputStub.onFirstCall().callsFake((options?: vscode.InputBoxOptions): Thenable<string> => {
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
                inputStub.onFirstCall().callsFake((options?: vscode.InputBoxOptions): Thenable<string> => {
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
                quickPickStub.resolves({label: 'Token', description: 'Log in to the given server using bearer token'});
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
                execStub.rejects(fatalError);
                let expectedErr: { message: any };
                try {
                    await Cluster.tokenLogin();
                } catch (error) {
                    expectedErr = error;
                }
                expect(expectedErr.message).equals(`Failed to login to cluster '${testUrl}' with '${fatalError.message}'!`);
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
            execStub.onSecondCall().resolves(errorData);
            infoStub.resolves('Yes');
            quickPickStub.onFirstCall().resolves('Credentials');
            quickPickStub.onSecondCall().resolves({description: "Current Context", label: testUrl});
            quickPickStub.onThirdCall().resolves({description: "Current Context", label: testUrl});
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

    suite('switchContext', () => {
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

    suite('open console', () => {
        const openStub: sinon.SinonStub = sinon.stub();
        let clusterMock: { openshiftConsole: { (arg0: TestItem): void; (): void; (): void } };
        let cluster: TestItem;

        setup(() => {
            clusterMock = pq('../../../src/openshift/cluster', {
                open: openStub
            }).Cluster;
            cluster = new TestItem(null, 'http://localhost', ContextType.CLUSTER);
        });

        test('opens URL from cluster\'s tree item label if called from cluster\'s context menu', () => {
            clusterMock.openshiftConsole(cluster);
            openStub.calledOnceWith('http://localhost');
        });

        test('opens URL from first cluster label', () => {
            sandbox.stub(OdoImpl.prototype, 'getClusters').resolves([cluster]);
            clusterMock.openshiftConsole();
            openStub.calledOnceWith('http://localhost');
        });

        test('shows error message if node label is not URL', () => {
            sandbox.stub(OdoImpl.prototype, 'getClusters').resolves([cluster]);
            const errMsgStub = sandbox.stub(vscode.window, 'showErrorMessage');
            clusterMock.openshiftConsole();
            errMsgStub.calledOnceWith('localhost', undefined);
        });

        test('opens cluster\'s URL from context menu', () => {
            execStub.onFirstCall().resolves({
                error: null,
                stderr: fatalErrorText,
                stdout: 'output'
            });
            execStub.onSecondCall().resolves({
                error: null,
                stderr: fatalErrorText,
                stdout: routeObj
            });
            clusterMock.openshiftConsole(cluster);
            openStub.calledOnceWith('http://localhost');
        });
    });
});
