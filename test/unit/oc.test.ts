/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { window } from 'vscode';
import { CliChannel } from '../../src/cli';
import { Oc } from '../../src/oc';
import { ContextType, getInstance } from '../../src/odo';
import { ToolsConfig } from '../../src/tools';
import { TestItem } from './openshift/testOSItem';

const {expect} = chai;
chai.use(sinonChai);

suite('Oc', function() {
    let sandbox: sinon.SinonSandbox;
    let detectOrDownloadStub: sinon.SinonStub<[string], Promise<string>>;
    let warnStub: sinon.SinonStub<[string, import('vscode').MessageOptions, ...import('vscode').MessageItem[]], Thenable<import('vscode').MessageItem>>;
    let execStub: sinon.SinonStub;
    let getActiveProjectStub: sinon.SinonStub;
    const clusterItem = new TestItem(null, 'cluster', ContextType.CLUSTER);
    const projectItem = new TestItem(clusterItem, 'my-project', ContextType.PROJECT);

    const sampleYaml = `
        # manifests.yaml
        apiVersion: image.openshift.io/v1
        kind: ImageStream
        metadata:
        labels:
            app: spring-petclinic
        name: spring-petclinic
    `;
    const TextEditorMock = {
        document: {
            fileName: 'manifests.yaml',
            getText: sinon.stub().returns(sampleYaml),
        },
    };

    setup(function() {
        sandbox = sinon.createSandbox();
        warnStub = sandbox.stub(window, 'showWarningMessage');
        execStub = sandbox.stub(CliChannel.prototype, 'execute');
        getActiveProjectStub = sandbox.stub(getInstance(), 'getActiveProject').resolves('my-project');
        detectOrDownloadStub = sandbox.stub(ToolsConfig, 'detect').resolves('path');
        sandbox.stub(getInstance(), 'getClusters').resolves([clusterItem]);
        sandbox.stub(getInstance(), 'getProjects').resolves([projectItem]);
    });

    teardown(function() {
        sandbox.restore();
    });

    test('show warning message if file is not json or yaml', async function() {
        await Oc.create();
        expect(warnStub).is.calledOnce;
    });

    test('show warning message if file is untitled', async function() {
        sandbox.stub(window, 'activeTextEditor').value({
            document: {
                fileName: 'manifests.yaml',
                isUntitled: true,
            },
        });
        detectOrDownloadStub.onFirstCall().resolves(undefined);
        await Oc.create();
        expect(warnStub).is.calledOnce;
    });

    test('show warning message if oc command not found', async function() {
        sandbox.stub(window, 'activeTextEditor').value({
            document: {
                fileName: 'manifests.yaml',
            },
        });
        detectOrDownloadStub.onFirstCall().resolves(undefined);
        await Oc.create();
        expect(warnStub).is.calledOnce;
    });

    test('Save the file if user click on Save button', async function() {
        execStub.resolves({
            error: undefined,
            stderr: '',
            stdout: 'imagestream.image.openshift.io/spring-petclinic created\ndeploymentconfig.apps.openshift.io/spring-petclinic created'
        });
        sandbox.stub<any, any>(window, 'showInformationMessage').resolves('Save');
        sandbox.stub(window, 'activeTextEditor').value({
            document: {
                fileName: 'manifests.yaml',
                isDirty: true,
                save: sinon.stub().returns(true)
            },
        });
        const result = await Oc.create();
        expect(result).equals('Resources were successfully created.');
    });

    test('show warning message if file content is changed', async function() {
        const infoMsg = sandbox.stub(window, 'showInformationMessage').resolves(undefined);
        sandbox.stub(window, 'activeTextEditor').value({
            document: {
                fileName: 'manifests.yaml',
                isDirty: true,
            },
        });
        await Oc.create();
        expect(warnStub).is.calledOnce;
        expect(infoMsg).is.calledOnce;
    });

    test('Creates an OpenShift resource using `.json` or `.yaml` file location from an active editor', async function() {
        execStub.resolves({
            error: undefined,
            stderr: '',
            stdout: 'imagestream.image.openshift.io/spring-petclinic created\ndeploymentconfig.apps.openshift.io/spring-petclinic created'
        });
        sandbox.stub(window, 'activeTextEditor').value(TextEditorMock);
        const result = await Oc.create();
        expect(result).equals('Resources were successfully created.');
    });

    test('errors when fail to create resource', async function() {
        let savedErr: any;
        execStub.rejects('error');
        sandbox.stub(window, 'activeTextEditor').value(TextEditorMock);
        try {
            await Oc.create();
        } catch (err) {
            savedErr = err;
        }
        expect(savedErr === 'error');
    });

    test('errors when there is no active project', async function() {
        getActiveProjectStub.resetBehavior();
        getActiveProjectStub.resolves(undefined);
        sandbox.stub(window, 'activeTextEditor').value(TextEditorMock);
        expect(await Oc.create()).null;
    });

});
