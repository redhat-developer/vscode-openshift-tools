/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl } from '../../../src/odo';
import { Progress } from '../../../src/util/progress';
import { DeploymentConfig, Command } from '../../../src/k8s/deployment';

const expect = chai.expect;
chai.use(sinonChai);

suite('K8s/deployment', () => {
    let termStub: sinon.SinonStub;
    let quickPickStub: sinon.SinonStub;
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    const errorMessage = 'FATAL ERROR';

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
                "apiVersion": "app.openshift.io/v1",
                "kind": "DeploymentConfig",
                "metadata": {
                    "annotations": {
                        "app.kubernetes.io/component-source-type": "git",
                        "app.kubernetes.io/url": "https://github.com/sclorg/nodejs-ex"
                    },
                    "creationTimestamp": "2019-07-15T09:18:43Z",
                    "name": "nodejs-comp-nodejs-app",
                    "namespace": "myproject",
                    "resourceVersion": "116630",
                    "selfLink": "/apis/app.openshift.io/v1/namespaces/myproject/DeploymentConfig/nodejs-comp-nodejs-app",
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
        sandbox = sinon.createSandbox();
        termStub =  sandbox.stub(OdoImpl.prototype, 'executeInTerminal');
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({ stdout: "" });
        sandbox.stub(Progress, 'execFunctionWithProgress').yields();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('Deploy', () => {
        const context = {
            name: "nodejs-comp-nodejs-app",
            metadata: undefined,
            namespace: null,
            nodeCategory: "Kubernetes-explorer-node",
            nodeType: "resource",
            resourceId: "bc/nodejs-comp-nodejs-app"
        };

        setup(() => {
            execStub.resolves({ error: undefined, stdout: mockData, stderr: '' });
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.resolves({label: "nodejs-comp-nodejs-app"});
        });

        test('works from context menu', async () => {
            const result = await DeploymentConfig.deploy(context);

            expect(result).equals(`Deployment successfully created for '${context.name}'.`);
            expect(execStub).calledWith(Command.deploy(context.name));
        });

        test('works with no context', async () => {
            const result = await DeploymentConfig.deploy(null);

            expect(result).equals(`Deployment successfully created for '${context.name}'.`);
            expect(execStub).calledWith(Command.deploy(context.name));
        });

        test('returns null when no DeploymentConfig selected', async () => {
            quickPickStub.resolves();
            const result = await DeploymentConfig.deploy(null);
            expect(result).null;
        });

        test('wraps errors in additional info', async () => {
            execStub.rejects(errorMessage);

            try {
                await DeploymentConfig.deploy(context);
            } catch (err) {
                expect(err).equals(`Failed to create Deployment with error '${errorMessage}'.`);
            }
        });

        test('throws error if there is no DeploymentConfig to select', async () => {
            quickPickStub.restore();
            execStub.resolves({ error: undefined, stdout: noBcData, stderr: '' });
            let checkError: Error;
            try {
                await DeploymentConfig.deploy(null);
            } catch (err) {
                checkError = err as Error;
            }
            expect(checkError.message).equals('You have no DeploymentConfigs available to deploy');
        });
    });

    suite('Show Log', () => {

        const context = {
            name: "nodejs-comp-nodejs-app",
            metadata: undefined,
            namespace: null,
            nodeCategory: "Kubernetes-explorer-node",
            nodeType: "resource",
            resourceId: "bc/nodejs-comp-nodejs-app"
        };

        setup(() => {
            execStub.resolves({ error: null, stdout: mockData, stderr: '' });
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.resolves({label: "nodejs-comp-nodejs-app"});
        });

        test('works from context menu', async () => {
            await DeploymentConfig.showLog(context);
            expect(termStub).calledOnceWith(Command.showDeploymentConfigLog("nodejs-comp-nodejs-app"));
        });

        test('works with no context', async () => {
            await DeploymentConfig.showLog(null);
            expect(termStub).calledOnceWith(Command.showDeploymentConfigLog('nodejs-comp-nodejs-app'));
        });

        test('returns null when no replica selected', async () => {
            quickPickStub.resolves(null);
            const result = await DeploymentConfig.showLog(null);
            expect(result).null;
        });
    });

    suite('Delete', ()=> {
        const context = {
            id: "dummy",
            impl: {
                id: "rc/comp1-app-2",
                kind: {
                    manifestKind: "ReplicationController",
                    abbreviation: "rc"
                },
                namespace: "myproject",
                name: "comp1-app-2",
                number: 2,
                manifest: "ReplicationController",
                metadata: undefined,
                node: "rc",
                resourceId: "rc/comp1-app-2"
            },
            resourceKind: {
                manifestKind: "ReplicationController",
                abbreviation: "rc"
            },
            nodeCategory: "kubernetes-explorer-node",
            nodeType: "extension"
        };

        const deploymentData = `comp1-app-1\\ncomp1-app-2`;

        setup(() => {
            execStub.resolves({ error: null, stdout: deploymentData, stderr: '' });
            sandbox.stub(DeploymentConfig, 'getDeploymentConfigNames').resolves("comp1-app-2");
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
        });

        test('works from context menu', async () => {
            const result = await DeploymentConfig.delete(context);

            expect(result).equals(`Replica '${context.impl.name}' successfully deleted`);
            expect(execStub).calledWith(Command.delete(context.impl.name));
        });

        test('works with no context', async () => {
            quickPickStub.onFirstCall().resolves({label: "comp1-app-2"});
            quickPickStub.onSecondCall().resolves("comp1-app-2");
            const result = await DeploymentConfig.delete(null);

            expect(result).equals(`Replica '${context.impl.name}' successfully deleted`);
            expect(execStub).calledWith(Command.delete(context.impl.name));
        });

        test('returns null when no ReplicationController selected to delete', async () => {
            quickPickStub.resolves();
            const result = await DeploymentConfig.delete(null);
            expect(result).null;
        });

        test('wraps errors in additional info', async () => {
            execStub.rejects(errorMessage);

            try {
                await DeploymentConfig.delete(context);
            } catch (err) {
                expect(err).equals(`Failed to delete replica with error '${errorMessage}'`);
            }
        });
    });

});