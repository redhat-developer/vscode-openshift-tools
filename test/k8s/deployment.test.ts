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
import { Progress } from '../../src/util/progress';
import * as Deployment from '../../src/k8s/deployment';

const expect = chai.expect;
chai.use(sinonChai);

suite('K8s/deployment', () => {
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
        sandbox.stub(OdoImpl.prototype, 'executeInTerminal');
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({ stdout: "" });
        sandbox.stub(Progress, 'execFunctionWithProgress').yields();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('Deploy', () => {
        const context = {
            id: "nodejs-comp-nodejs-app",
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
            const result = await Deployment.deploy(context);

            expect(result).equals(`Deployment successfully created for '${context.id}'.`);
            expect(execStub).calledWith(Deployment.Command.deploy(context.id));
        });

        test('works with no context', async () => {
            const result = await Deployment.deploy(null);

            expect(result).equals(`Deployment successfully created for '${context.id}'.`);
            expect(execStub).calledWith(Deployment.Command.deploy(context.id));
        });

        test('returns null when no DeploymentConfig selected', async () => {
            quickPickStub.resolves();
            const result = await Deployment.deploy(null);
            expect(result).null;
        });

        test('wraps errors in additional info', async () => {
            execStub.rejects(errorMessage);

            try {
                await Deployment.deploy(context);
            } catch (err) {
                expect(err).equals(`Failed to create Deployment with error '${errorMessage}'.`);
            }
        });

        test('throws error if there is no DeploymentConfig to select', async () => {
            quickPickStub.restore();
            execStub.resolves({ error: undefined, stdout: noBcData, stderr: '' });
            let checkError: Error;
            try {
                await Deployment.deploy(null);
            } catch (err) {
                checkError = err as Error;
            }
            expect(checkError.message).equals('You have no DeploymentConfigs available to deploy');
        });
    });

});