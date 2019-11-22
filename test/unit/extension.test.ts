/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { Cluster } from '../../src/openshift/cluster';
import { Application } from '../../src/openshift/application';
import { Catalog } from '../../src/openshift/catalog';
import { Component } from '../../src/openshift/component';
import { Project } from '../../src/openshift/project';
import { Service } from '../../src/openshift/service';
import { Storage } from '../../src/openshift/storage';
import { Url } from '../../src/openshift/url';
import packagejson = require('../../package.json');
import { OpenShiftExplorer } from '../../src/explorer';
import path = require('path');
import { OdoImpl, ContextType, OpenShiftObjectImpl, OpenShiftObject } from '../../src/odo';
import { Oc } from '../../src/oc';
import * as extension from '../../src/extension';
import { ClusterExplorerV1 } from 'vscode-kubernetes-tools-api';
import * as k8s from 'vscode-kubernetes-tools-api';

const expect = chai.expect;
chai.use(sinonChai);

suite('openshift connector Extension', async () => {
    let sandbox: sinon.SinonSandbox;
    let kubectlV1Stub: sinon.SinonStub<any[], any>;
    let getObjectByPathStub: sinon.SinonStub<[string], OpenShiftObject>;
    let getChildrenByParentStub: sinon.SinonStub<[OpenShiftObject], OpenShiftObject[]>;

    const clusterItem = new OpenShiftObjectImpl(OdoImpl.ROOT, 'cluster', ContextType.CLUSTER, false, OdoImpl.Instance);
    const projectItem = new OpenShiftObjectImpl(clusterItem, 'myproject', ContextType.PROJECT, false, OdoImpl.Instance);
    const appItem = new OpenShiftObjectImpl(projectItem, 'app1', ContextType.APPLICATION, false, OdoImpl.Instance);
    const fixtureFolder = path.join(__dirname, '..', '..', '..', 'test', 'fixtures').normalize();
    const comp2Uri = vscode.Uri.file(path.join(fixtureFolder, 'components', 'comp2'));
    const treeItem = {
        collapsibleState: 1,
        contextValue: "vsKubernetes.cluster",
        label: "minishift",
        conPath: {
            _formatted: null,
            _fsPath: "/Users/.vscode/extensions/ms-kubernetes-tools.vscode-kubernetes-tools-1.0.7/images/k8s-logo.png",
            authority: "",
            fragment: "",
            fsPath: "/Users/.vscode/extensions/ms-kubernetes-tools.vscode-kubernetes-tools-1.0.7/images/k8s-logo.png",
            path: "/Users/.vscode/extensions/ms-kubernetes-tools.vscode-kubernetes-tools-1.0.7/images/k8s-logo.png",
            query: "",
            scheme: "file"
        },
        tooltip: "minishift\nCluster: 192-168-64-222:8443"
    };

    const configView = `
        {
            "kind": "Config",
            "apiVersion": "v1",
            "preferences": {},
            "contexts": [
                {
                    "name": "minishift",
                    "context": {
                        "cluster": "192-168-64-222:8443",
                        "user": "developer/192-168-64-222:8443",
                        "namespace": "myproject"
                    }
                }
            ],
            "current-context": "minishift"
        }
    `;

    const sr = 'apps.openshift.io/v1';

    setup(async () => {
        sandbox = sinon.createSandbox();
        sandbox.stub(vscode.workspace, 'workspaceFolders').value([{
            uri: vscode.Uri.file(path.join(fixtureFolder, 'components', 'comp1')), index: 0, name: 'comp1'
        }, {
            uri: comp2Uri, index: 1, name: 'comp2'
        }]);
        try {
            await vscode.commands.executeCommand('openshift.output');
        } catch (ignore) {
        } finally {
        }
        sandbox.stub(OdoImpl.prototype, '_getClusters').resolves([clusterItem]);
        sandbox.stub(OdoImpl.prototype, '_getProjects').resolves([projectItem]);
        sandbox.stub(OdoImpl.prototype, '_getApplications').resolves([appItem]);
        sandbox.stub(OdoImpl.prototype, '_getServices').resolves([]);
        getObjectByPathStub = sandbox.stub(OdoImpl.data, 'getObjectByPath');
        getChildrenByParentStub = sandbox.stub(OdoImpl.data, 'getChildrenByParent');
        kubectlV1Stub = sandbox.stub(k8s.extension.kubectl, 'v1');
    });

    teardown(() => {
        sandbox.restore();
        OdoImpl.Instance.clearCache();
    });

    test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('redhat.vscode-openshift-connector'));
	});

    function getStaticMethodsToStub(osc: string[]): string[] {
        const mths: Set<string> = new Set();
        osc.forEach((name) => {
            name = name.replace('.palette', '');
            const segs: string[] = name.split('.');
            let methName: string = segs[segs.length-1];
            methName = methName === 'delete'? 'del' : methName;
            !mths.has(methName) && mths.add(methName);
        });
        return [...mths];
    }

    test('should activate extension', async () => {
        sandbox.stub(vscode.window, 'showErrorMessage');
        const cmds: string[] = await vscode.commands.getCommands();
        const osc: string[] = cmds.filter((item) => item.startsWith('openshift.'));
        const mths: string[] = getStaticMethodsToStub(osc);
        [Application, Catalog, Cluster, Component, Project, Service, Storage, Url, OpenShiftExplorer, Oc].forEach((item: { [x: string]: any; }) => {
            mths.forEach((name) => {
                if (item[name]) {
                    sandbox.stub(item, name).resolves();
                }
            });
        });
        for (const command of osc) {
            await vscode.commands.executeCommand(command);
        }
        expect(vscode.window.showErrorMessage).has.not.been.called;
    });

    test('should load components from workspace folders', async () => {
        sandbox.stub(OdoImpl.prototype, 'execute').resolves({error: undefined, stdout: '', stderr: ''});
        const components = await OdoImpl.Instance.getApplicationChildren(appItem);
        expect(components.length).is.equals(2);
    });

    test('should load components from added folders', async () => {
        sandbox.stub(OdoImpl.prototype, 'execute').resolves({error: undefined, stdout: '', stderr: ''});
        OdoImpl.Instance.loadWorkspaceComponents({
            added: [{
                uri: vscode.Uri.file(path.join(fixtureFolder, 'components', 'comp3')),
                index: 0,
                name: 'comp3'
            }],
            removed: undefined
        });
        getObjectByPathStub.returns(projectItem);
        getChildrenByParentStub.returns([appItem]);
        const components = await OdoImpl.Instance.getApplicationChildren(appItem);
        expect(components.length).is.equals(1);
    });

    test('insert new component if component not available', async () => {
        sandbox.stub(OdoImpl.prototype, 'execute').resolves({error: undefined, stdout: '', stderr: ''});
        OdoImpl.Instance.loadWorkspaceComponents({
            added: [{
                uri: vscode.Uri.file(path.join(fixtureFolder, 'components', 'comp3')),
                index: 0,
                name: 'comp3'
            }],
            removed: undefined
        });
        getObjectByPathStub.onFirstCall().returns(projectItem);
        getObjectByPathStub.onSecondCall().returns(appItem);
        getObjectByPathStub.onThirdCall().returns(undefined);
        getChildrenByParentStub.returns([appItem]);
        const components = await OdoImpl.Instance.getApplicationChildren(appItem);
        expect(components.length).is.equals(1);
    });

    test('insert new appliaction if application not available', async () => {
        sandbox.stub(OdoImpl.prototype, 'execute').resolves({error: undefined, stdout: '', stderr: ''});
        OdoImpl.Instance.loadWorkspaceComponents({
            added: [{
                uri: vscode.Uri.file(path.join(fixtureFolder, 'components', 'comp3')),
                index: 0,
                name: 'comp3'
            }],
            removed: undefined
        });
        getObjectByPathStub.onFirstCall().returns(projectItem);
        getObjectByPathStub.onSecondCall().returns(undefined);
        getChildrenByParentStub.returns([appItem]);
        const components = await OdoImpl.Instance.getApplicationChildren(appItem);
        expect(components.length).is.equals(1);
    });

    test('customize k8s cluster resource Project node', async () => {
        const node = <ClusterExplorerV1.ClusterExplorerResourceNode>{
            name: "",
            namespace: null,
            nodeType: "resource",
            resourceKind: {
                abbreviation: "",
                manifestKind: "Project",
            }
        };
        const result = await extension.customize(node, treeItem);
        expect(result).equals(undefined);
    });

    test('customize k8s cluster resource BuildConfig|DeploymentConfig node', async () => {
        const node = <ClusterExplorerV1.ClusterExplorerResourceNode>{
            name: "",
            namespace: null,
            nodeType: "resource",
            resourceKind: {
                abbreviation: "",
                manifestKind: "BuildConfig",
            }
        };
        const result = await extension.customize(node, treeItem);
        expect(result).equals(undefined);
    });

    test('customize k8s cluster context node', async () => {
        const apiConfig: k8s.API<k8s.KubectlV1> = {
            available: true,
            api: {
                invokeCommand: sandbox.stub().resolves({ stdout: configView, stderr: '', code: 0}),
                portForward: sandbox.stub()
            }
        };
        const apiVersion: k8s.API<k8s.KubectlV1> = {
            available: true,
            api: {
                invokeCommand: sandbox.stub().resolves({ stdout: sr, stderr: '', code: 0}),
                portForward: sandbox.stub()
            }
        };
        kubectlV1Stub.onSecondCall().resolves(apiConfig);
        kubectlV1Stub.onThirdCall().resolves(apiVersion);
        const node = <ClusterExplorerV1.ClusterExplorerContextNode>{
            name: "minishift",
            nodeType: "context",
        };
        const result = await extension.customize(node, treeItem);
        expect(result).equals(undefined);
    });

    test('should remove components loaded from removed folders', async () => {
        sandbox.stub(OdoImpl.prototype, 'execute').resolves({error: undefined, stdout: '', stderr: ''});
        OdoImpl.Instance.loadWorkspaceComponents({
            removed: [{
                uri: comp2Uri,
                index: 0,
                name: 'comp2'
            }],
            added: undefined
        });
        getObjectByPathStub.returns(projectItem);
        const components = await OdoImpl.Instance.getApplicationChildren(appItem);
        expect(components.length).is.equals(3);
    });

    test('should register all extension commands declared commands in package descriptor', async () => {
        return await vscode.commands.getCommands(true).then((commands) => {
            packagejson.contributes.commands.forEach((value)=> {
                expect(commands.indexOf(value.command) > -1, `Command '${value.command}' handler is not registered during activation`).true;
            });
        });
    });

    test('async command wrapper shows message returned from command', async () => {
        sandbox.stub(Cluster, 'login').resolves('message');
        sandbox.stub(vscode.window, 'showErrorMessage');
        const simStub: sinon.SinonStub = sandbox.stub(vscode.window, 'showInformationMessage');
        await vscode.commands.executeCommand('openshift.explorer.login');
        expect(simStub).calledWith('message');
    });

    test('async command wrapper shows error message from rejected command', async () => {
        sandbox.stub(Cluster, 'login').returns(Promise.reject('message'));
        const semStub: sinon.SinonStub = sandbox.stub(vscode.window, 'showErrorMessage');
        sandbox.stub(vscode.window, 'showInformationMessage');
        await vscode.commands.executeCommand('openshift.explorer.login');
        expect(semStub).calledWith('message');
    });

    test('async command wrapper shows error.message from rejected command', async () => {
        sandbox.stub(Cluster, 'login').returns(Promise.reject(new Error('message')));
        const semStub: sinon.SinonStub = sandbox.stub(vscode.window, 'showErrorMessage');
        sandbox.stub(vscode.window, 'showInformationMessage');
        await vscode.commands.executeCommand('openshift.explorer.login');
        expect(semStub).calledWith('message');
    });

    test('sync command wrapper shows message returned from command', async () => {
        sandbox.stub(Cluster, 'about');
        sandbox.stub(vscode.window, 'showErrorMessage');
        const simStub: sinon.SinonStub = sandbox.stub(vscode.window, 'showInformationMessage');
        await vscode.commands.executeCommand('openshift.about');
        expect(simStub).not.called;
    });

    test('sync command wrapper shows message returned from command', async () => {
        const error = new Error('Message');
        sandbox.stub(Cluster, 'refresh').throws(error);
        const semStub: sinon.SinonStub = sandbox.stub(vscode.window, 'showErrorMessage');
        await vscode.commands.executeCommand('openshift.explorer.refresh');
        expect(semStub).calledWith(error);
    });
});
