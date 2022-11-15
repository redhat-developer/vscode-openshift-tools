/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import * as k8s from 'vscode-kubernetes-tools-api';
import { Build } from '../../../src/k8s/build';
import { CliChannel } from '../../../src/cli';

const {expect} = chai;
chai.use(sinonChai);

suite('K8s/build', () => {
    let quickPickStub: sinon.SinonStub;
    let sandbox: sinon.SinonSandbox;
    let termStub: sinon.SinonStub;
    let execStub: sinon.SinonStub;
    const errorMessage = 'FATAL ERROR';
    const context = {
        id: 'dummy',
        impl: {
            id: 'build/nodejs-copm-nodejs-comp-8',
            metadata: undefined,
            name: 'nodejs-copm-nodejs-comp-8',
            namespace: 'myproject'
        }
    };

    const buildData = `{
        "apiVersion": "v1",
        "items": [
            {
                "apiVersion": "build.openshift.io/v1",
                "kind": "Build",
                "metadata": {
                    "annotations": {
                        "openshift.io/build-config.name": "nodejs-copm-nodejs-comp"
                    },
                    "creationTimestamp": "2019-07-19T13:29:52Z",
                    "labels": {
                        "app": "nodejs-comp"
                    },
                    "name": "nodejs-copm-nodejs-comp-8",
                    "namespace": "myproject",
                    "resourceVersion": "60465",
                    "selfLink": "/apis/build.openshift.io/v1/namespaces/myproject/builds/nodejs-copm-nodejs-comp-8",
                    "uid": "4a5be709-aa29-11e9-99f2-5e5dae55d430"
                }
            }
        ],
        "kind": "List",
        "metadata": {
            "resourceVersion": "",
            "selfLink": ""
        }
    }`;

    setup(() => {
        sandbox = sinon.createSandbox();
        termStub = sandbox.stub(CliChannel.prototype, 'executeInTerminal');
        execStub = sandbox.stub(CliChannel.prototype, 'execute').resolves({ stdout: '', stderr: undefined, error: undefined });
        // sandbox.stub(Progress, 'execFunctionWithProgress').yields();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('BuildConfigNodeContributor', () => {
        const parent = {
            metadata: undefined,
            name: 'comp1-app',
            namespace: null,
            nodeType: 'resource',
            resourceKind: {
                abbreviation: 'bc',
                description: '',
                displayName: 'BuildConfigs',
                label: 'BuildConfigs',
                manifestKind: 'BuildConfigs',
                pluralDisplayName: 'BuildConfigs'
            }
        } as k8s.ClusterExplorerV1.ClusterExplorerNode;

        setup(() => {
            const api: k8s.API<k8s.KubectlV1> = {
                available: true,
                api: {
                    invokeCommand: sandbox.stub().resolves({ stdout: 'namespace, name, 1', stderr: '', code: 0}),
                    portForward: sandbox.stub()
                }
            };
            sandbox.stub(k8s.extension.kubectl, 'v1').value(api);
        });

        test('should able to get the children node of build Config', async () => {
            const bcnc = Build.getNodeContributor();
            const result = await bcnc.getChildren(parent);
            expect(result.length).equals(1);
        });
    });

    suite('start build', () => {
        const startBuildCtx = {
            name: 'nodejs-comp-nodejs-app',
            metadata: undefined,
            namespace: null,
            nodeCategory: 'Kubernetes-explorer-node',
            nodeType: 'resource',
            resourceId: 'bc/nodejs-comp-nodejs-app'
        };

    const noBcData = `{
        "apiVersion": "v1",
        "items": [],
        "kind": "List",
        "metadata": {
            "resourceVersion": "",
            "selfLink": ""
        }
    }`;

    const mockData = `{
        "apiVersion": "v1",
        "items": [
            {
                "apiVersion": "build.openshift.io/v1",
                "kind": "BuildConfig",
                "metadata": {
                    "annotations": {
                        "app.kubernetes.io/component-source-type": "git",
                        "app.kubernetes.io/url": "https://github.com/sclorg/nodejs-ex"
                    },
                    "creationTimestamp": "2019-07-15T09:18:43Z",
                    "name": "nodejs-comp-nodejs-app",
                    "namespace": "myproject",
                    "resourceVersion": "116630",
                    "selfLink": "/apis/build.openshift.io/v1/namespaces/myproject/buildconfigs/nodejs-comp-nodejs-app",
                    "uid": "8a66b3ff-a6e1-11e9-8dbe-22967c349399"
                },
                "status": {
                    "lastVersion": 8
                }
            }
        ],
        "kind": "List",
        "metadata": {
            "resourceVersion": "",
            "selfLink": ""
        }
    }`;
        setup(() => {
            execStub.resolves({ stdout: mockData, stderr: undefined, error: undefined });
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.resolves({label: 'nodejs-comp-nodejs-app'});
        });

        test('works from context menu', async () => {
            const result = await Build.startBuild(startBuildCtx);

            expect(result).equals(`Build '${startBuildCtx.name}' successfully started`);
            expect(execStub).calledWith(Build.command.startBuild(startBuildCtx.name).toString());
        });

        test('works with no context', async () => {
            const result = await Build.startBuild(null);

            expect(result).equals(`Build '${startBuildCtx.name}' successfully started`);
            expect(execStub).calledWith(Build.command.startBuild(startBuildCtx.name).toString());
        });

        test('returns null when no BuildConfig selected', async () => {
            quickPickStub.resolves();
            const result = await Build.startBuild(null);
            expect(result).null;
        });

        test('wraps errors in additional info', async () => {
            execStub.rejects(errorMessage);

            try {
                await Build.startBuild(startBuildCtx);
            } catch (err) {
                expect(err.message).equals(`Failed to start build with error '${errorMessage}'`);
            }
        });

        test('throws error if there is no BuildConfigs to select', async () => {
            quickPickStub.restore();
            execStub.resolves({ error: undefined, stdout: noBcData, stderr: '' });
            let checkError: Error;
            try {
                await Build.startBuild(null);
            } catch (err) {
                checkError = err as Error;
            }
            expect(checkError.message).equals('You have no BuildConfigs available to start a build');
        });
    });

    suite('Show Log', () => {

        setup(() => {
            execStub.resolves({ error: null, stdout: buildData, stderr: '' });
            const buidConfig = {label: 'nodejs-copm-nodejs-comp'};
            sandbox.stub(Build, 'getBuildConfigNames').resolves([buidConfig]);
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(buidConfig);
            quickPickStub.onSecondCall().resolves({label: 'nodejs-copm-nodejs-comp-8'});
        });

        test('works from context menu', async () => {
            await Build.showLog(context);
            expect(termStub).calledOnceWith(Build.command.showLog(context.impl.name, '-build'));
        });

        test('works with no context', async () => {
            await Build.showLog(null);
            expect(termStub).calledOnceWith(Build.command.showLog('nodejs-copm-nodejs-comp-8', '-build'));
        });

        test('returns null when no build selected', async () => {
            quickPickStub.onSecondCall().resolves();
            const result = await Build.showLog(null);
            expect(result).null;
        });
    });

    suite('rebuild', () => {

        setup(() => {
            sandbox.stub<any, any>(Build, 'getBuildNames').resolves('nodejs-copm-nodejs-comp');
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.resolves({label: 'nodejs-copm-nodejs-comp-8'});

        });

        test('works from context menu', async () => {
            execStub.resolves({ error: null, stdout: 'nodejs-copm-nodejs-comp', stderr: '' });
            await Build.rebuild(context);
            expect(termStub).calledOnceWith(Build.command.rebuildFrom(context.impl.name));
        });

        test('works with no context', async () => {
            execStub.onFirstCall().resolves({ error: null, stdout: buildData, stderr: '' });
            execStub.onSecondCall().resolves({ error: null, stdout: 'nodejs-copm-nodejs-comp', stderr: '' });
            await Build.rebuild(null);
            expect(termStub).calledOnceWith(Build.command.rebuildFrom('nodejs-copm-nodejs-comp-8'));
        });

        test('returns null when no build selected to rebuild', async () => {
            execStub.onFirstCall().resolves({ error: null, stdout: buildData, stderr: '' });
            execStub.onSecondCall().resolves({ error: null, stdout: 'nodejs-copm-nodejs-comp', stderr: '' });
            quickPickStub.resolves();
            const result = await Build.rebuild(null);
            expect(result).null;
        });
    });

    suite('followLog', () => {

        setup(() => {
            execStub.resolves({ error: null, stdout: buildData, stderr: '' });
            sandbox.stub<any, any>(Build, 'getBuildNames').resolves('nodejs-copm-nodejs-comp');
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.resolves({label: 'nodejs-copm-nodejs-comp-8'});
        });

        test('works from context menu', async () => {
            await Build.followLog(context);
            expect(termStub).calledOnceWith(Build.command.followLog(context.impl.name, '-build'));
        });

        test('works with no context', async () => {
            await Build.followLog(null);
            expect(termStub).calledOnceWith(Build.command.followLog('nodejs-copm-nodejs-comp-8', '-build'));
        });

        test('returns null when no build selected', async () => {
            quickPickStub.resolves();
            const result = await Build.followLog(null);
            expect(result).null;
        });
    });

    suite('Delete', ()=> {
        setup(() => {
            execStub.resolves({ error: null, stdout: buildData, stderr: '' });
            sandbox.stub<any, any>(Build, 'getBuildNames').resolves('nodejs-copm-nodejs-comp');
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.resolves({label: 'nodejs-copm-nodejs-comp-8'});
        });

        test('works from context menu', async () => {
            const result = await Build.delete(context);

            expect(result).equals(`Build '${context.impl.name}' successfully deleted`);
            expect(execStub).calledWith(Build.command.delete(context.impl.name).toString());
        });

        test('works with no context', async () => {
            const result = await Build.delete(null);

            expect(result).equals('Build \'nodejs-copm-nodejs-comp-8\' successfully deleted');
            expect(execStub).calledWith(Build.command.delete('nodejs-copm-nodejs-comp-8').toString());
        });

        test('returns null when no build selected to delete', async () => {
            quickPickStub.resolves();
            const result = await Build.delete(null);
            expect(result).null;
        });

        test('wraps errors in additional info', async () => {
            execStub.rejects(errorMessage);

            try {
                await Build.delete(context);
            } catch (err) {
                expect(err.message).equals(`Failed to delete build with error '${errorMessage}'`);
            }
        });
    });

});
