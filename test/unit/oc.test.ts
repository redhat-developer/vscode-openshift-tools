/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window } from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { Oc } from '../../src/oc';
import { ContextType } from '../../src/odo';
import { ToolsConfig } from '../../src/tools';
import { TestItem } from './openshift/testOSItem';
import { CliChannel } from '../../src/cli';
import OpenShiftItem from '../../src/openshift/openshiftItem';

const {expect} = chai;
chai.use(sinonChai);

suite('Oc', () => {
    let sandbox: sinon.SinonSandbox;
    let detectOrDownloadStub: sinon.SinonStub<[string], Promise<string>>;
    let warnStub: sinon.SinonStub<[string, import("vscode").MessageOptions, ...import("vscode").MessageItem[]], Thenable<import("vscode").MessageItem>>;
    let execStub: sinon.SinonStub;
    let quickPickStub: sinon.SinonStub<[import("vscode").QuickPickItem[] | Thenable<import("vscode").QuickPickItem[]>, import("vscode").QuickPickOptions?, import("vscode").CancellationToken?], Thenable<import("vscode").QuickPickItem>>;
    const clusterItem = new TestItem(null, 'cluster', ContextType.CLUSTER);
    const projectItem = new TestItem(clusterItem, 'myproject', ContextType.PROJECT);

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
            fileName: "manifests.yaml",
            getText: sinon.stub().returns(sampleYaml),
        },
    };

    setup(()=> {
        sandbox = sinon.createSandbox();
        warnStub = sandbox.stub(window, 'showWarningMessage');
        execStub = sandbox.stub(CliChannel.prototype, 'execute');
        quickPickStub = sandbox.stub(window, 'showQuickPick');
        detectOrDownloadStub = sandbox.stub(ToolsConfig, 'detect').resolves('path');
        sandbox.stub(OpenShiftItem, 'getProjectNames').resolves(projectItem);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('show warning message if file is not json or yaml', async () => {
        await Oc.create();
        expect(warnStub).is.calledOnce;
    });

    test('show warning message if oc command not found', async () => {
        sandbox.stub(window, "activeTextEditor").value({
            document: {
                fileName: "manifests.yaml",
            },
        });
        detectOrDownloadStub.onFirstCall().resolves(undefined);
        await Oc.create();
        expect(warnStub).is.calledOnce;
    });

    test('Save the file if user click on Save button', async () => {
        execStub.resolves({
            error: undefined,
            stderr: '',
            stdout: "imagestream.image.openshift.io/spring-petclinic created\ndeploymentconfig.apps.openshift.io/spring-petclinic created"
        });
        sandbox.stub(window, 'showInformationMessage').resolves('Save');
        quickPickStub.onFirstCall().resolves(projectItem);
        sandbox.stub(window, "activeTextEditor").value({
            document: {
                fileName: "manifests.yaml",
                isDirty: true,
                save: sinon.stub().returns(true)
            },
        });
        const result = await Oc.create();
        expect(result).equals('Resources were successfully created.');
    });

    test('show warning message if file content is changed', async () => {
        const infoMsg = sandbox.stub(window, 'showInformationMessage').resolves(undefined);
        sandbox.stub(window, "activeTextEditor").value({
            document: {
                fileName: "manifests.yaml",
                isDirty: true,
            },
        });
        await Oc.create();
        expect(warnStub).is.calledOnce;
        expect(infoMsg).is.calledOnce;
    });

    test('Creates an OpenShift resource using `.json` or `.yaml` file location from an active editor', async () => {
        execStub.resolves({
            error: undefined,
            stderr: '',
            stdout: "imagestream.image.openshift.io/spring-petclinic created\ndeploymentconfig.apps.openshift.io/spring-petclinic created"
        });
        sandbox.stub(window, "activeTextEditor").value(TextEditorMock);
        quickPickStub.onFirstCall().resolves(projectItem);
        const result = await Oc.create();
        expect(result).equals('Resources were successfully created.');
    });

    test('errors when fail to create resource', async () => {
        let savedErr: any;
        execStub.resolves({
            error: 'error',
            stderr: '',
            stdout: ""
        });
        sandbox.stub(window, "activeTextEditor").value(TextEditorMock);
        quickPickStub.onFirstCall().resolves(projectItem);
        try {
            await Oc.create();
        } catch (err) {
            savedErr = err;
        }
        expect(savedErr).equals('error');
    });

});
