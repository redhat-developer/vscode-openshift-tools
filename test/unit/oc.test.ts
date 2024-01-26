/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { window } from 'vscode';
import { Oc } from '../../src/oc/ocWrapper';
import { Project } from '../../src/oc/project';
import { Odo } from '../../src/odo/odoWrapper';
import { ToolsConfig } from '../../src/tools';
import { ChildProcessUtil } from '../../src/util/childProcessUtil';
import { YamlFileCommands } from '../../src/yamlFileCommands';

const {expect} = chai;
chai.use(sinonChai);

suite('Oc', function() {
    let sandbox: sinon.SinonSandbox;
    let detectOrDownloadStub: sinon.SinonStub<[string], Promise<string>>;
    let warnStub: sinon.SinonStub<[string, import('vscode').MessageOptions, ...import('vscode').MessageItem[]], Thenable<import('vscode').MessageItem>>;
    let execStub: sinon.SinonStub;
    let getActiveProjectStub: sinon.SinonStub;
    const projectItem: Project = { name: 'my-project', active: true };

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
        execStub = sandbox.stub(ChildProcessUtil.prototype, 'execute');
        getActiveProjectStub = sandbox.stub(Oc.Instance, 'getActiveProject').resolves('my-project');
        detectOrDownloadStub = sandbox.stub(ToolsConfig, 'detect').resolves('path');
        sandbox.stub(Odo.Instance, 'getActiveCluster').resolves('cluster');
        sandbox.stub(Oc.Instance, 'getProjects').resolves([projectItem]);
        sandbox.stub(Oc.Instance, 'canCreatePod').resolves(true);
    });

    teardown(function() {
        sandbox.restore();
    });

    test('show warning message if file is not json or yaml', async function() {
        await YamlFileCommands.create();
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
        await YamlFileCommands.create();
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
        const result = await YamlFileCommands.create();
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
        await YamlFileCommands.create();
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
        const result = await YamlFileCommands.create();
        expect(result).equals('Resources were successfully created.');
    });

    test('errors when fail to create resource', async function() {
        let savedErr: any;
        execStub.rejects('error');
        sandbox.stub(window, 'activeTextEditor').value(TextEditorMock);
        try {
            await YamlFileCommands.create();
        } catch (err) {
            savedErr = err;
        }
        expect(savedErr === 'error');
    });

    test('shows warning message when there is no active project', async function() {
        getActiveProjectStub.resetBehavior();
        getActiveProjectStub.resolves(undefined);
        sandbox.stub(window, 'activeTextEditor').value(TextEditorMock);
        expect(await YamlFileCommands.create());
        expect(warnStub).to.be.calledOnceWithExactly('The current project doesn\'t exist. Please select an existing project to work with or create a new project', 'Select or Create Project', 'Cancel');
    });

});
