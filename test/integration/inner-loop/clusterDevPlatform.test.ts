/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Exec, KubeConfig } from '@kubernetes/client-node';
import { expect } from 'chai';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Writable } from 'stream';
import { ComponentDescription, Data } from '../../../src/devfile/componentTypeDescription';
import { ClusterDevPlatform } from '../../../src/devfile/inner-loop/clusterDevPlatform';
import { DevPlatformSession } from '../../../src/devfile/inner-loop/devPlatform';
import { Oc } from '../../../src/oc/ocWrapper';
import { ComponentWorkspaceFolder } from '../../../src/odo/workspace';
import { connectAndRead } from './netTestUtils';

const COMPONENT_NAME = 'cluster-dev-platform-it';
const ENDPOINT_PORT = 8080;
const TEST_IMAGE = 'nodejs-image:latest';

function buildDevfile(): Data {
    return {
        schemaVersion: '2.2.0',
        metadata: { name: COMPONENT_NAME, version: '1.0.0' },
        components: [
            {
                name: 'runtime',
                container: {
                    image: TEST_IMAGE,
                    memoryLimit: '256Mi',
                    mountSources: true,
                    volumeMounts: [],
                    endpoints: [{ name: 'http', targetPort: ENDPOINT_PORT }],
                },
            },
        ],
        commands: [
            {
                id: 'run',
                exec: {
                    // Long-lived TCP server: replies 'hello' to any connection, then keeps
                    // running so restartRunCommand() has something to actually restart.
                    commandLine: `node -e "require('net').createServer(c=>{c.end('hello');}).listen(${ENDPOINT_PORT})"`,
                    component: 'runtime',
                    workingDir: '${PROJECT_SOURCE}',
                    group: { kind: 'run', isDefault: true },
                },
            },
        ],
    };
}

function buildComponentFolder(contextPath: string, devfile: Data): ComponentWorkspaceFolder {
    return {
        contextPath,
        component: {
            devfilePath: path.join(contextPath, 'devfile.yaml'),
            devfileData: {
                devfile,
                commands: [],
                supportedOdoFeatures: { debug: false, deploy: false, dev: true },
            },
            devForwardedPorts: [],
            runningIn: [],
            runningOn: [],
            managedBy: undefined,
        } as unknown as ComponentDescription,
    };
}

async function execCapture(kc: KubeConfig, namespace: string, podName: string, command: string[]): Promise<string> {
    const exec = new Exec(kc);
    const chunks: Buffer[] = [];
    const stdout = new Writable({
        write(chunk, _encoding, callback) {
            chunks.push(Buffer.from(chunk));
            callback();
        },
    });

    await new Promise<void>((resolve, reject) => {
        exec.exec(namespace, podName, 'runtime', command, stdout, null, null, false, (status) => {
            if (status.status === 'Failure') {
                reject(new Error(status.message ?? 'command failed'));
            } else {
                resolve();
            }
        }).catch(reject);
    });

    return Buffer.concat(chunks).toString('utf-8');
}

suite('devfile/inner-loop/clusterDevPlatform.ts', function () {
    this.timeout(180000);

    let componentPath: string;
    let platform: ClusterDevPlatform;
    let session: DevPlatformSession | undefined;
    let namespace: string;
    let previousNamespace: string;
    let kc: KubeConfig;
    const output: string[] = [];

    suiteSetup(async function () {
        componentPath = await fs.mkdtemp(path.join(os.tmpdir(), 'cluster-dev-platform-test-'));
        platform = new ClusterDevPlatform();
        kc = new KubeConfig();
        kc.loadFromDefault();

        // ClusterDevPlatform.start() correctly (matching real dev-mode usage) deploys into
        // whatever the *ambient current* namespace is, rather than taking one as a parameter —
        // so this test must pin a known-good namespace itself rather than trust whatever a prior,
        // unrelated suite left the kubeconfig context pointed at (several existing integration
        // tests switch the current namespace via Oc.Instance.createProject()/setProject() and
        // never restore it). Restoring it afterward (see suiteTeardown) avoids leaving that same
        // landmine for whatever runs next.
        previousNamespace = await Oc.Instance.getActiveProject();
        namespace = 'cluster-dev-platform-it-tests';
        await Oc.Instance.applyConfiguration(JSON.stringify({
            apiVersion: 'v1',
            kind: 'Namespace',
            metadata: { name: namespace },
        }));
        await Oc.Instance.setProject(namespace);
    });

    suiteTeardown(async function () {
        if (session) {
            await platform.stop(session).catch(() => {});
        }
        await fs.rm(componentPath, { recursive: true, force: true });
        await Oc.Instance.deleteKubernetesObject('namespace', namespace).catch(() => {});
        await Oc.Instance.setProject(previousNamespace).catch(() => {});
    });

    test('start() deploys the component, syncs sources, and forwards its endpoint', async function () {
        const devfile = buildDevfile();
        const componentFolder = buildComponentFolder(componentPath, devfile);

        session = await platform.start(devfile, componentFolder, {}, { onOutput: line => output.push(line) });

        expect(session.kind).to.equal('cluster');
        expect(session.forwardedPorts).to.have.lengthOf(1);
        expect(session.forwardedPorts[0].containerPort).to.equal(ENDPOINT_PORT);
        expect(session.forwardedPorts[0].portName).to.equal('http');

        const response = await connectAndRead(session.forwardedPorts[0].localPort);
        expect(response).to.equal('hello');
    });

    test('sync() pushes a new local file into the running container', async function () {
        await fs.writeFile(path.join(componentPath, 'marker.txt'), 'synced-content');

        await platform.sync(session!, ['marker.txt'], []);

        const podName = await Oc.Instance.getComponentPod(COMPONENT_NAME);
        const content = await execCapture(kc, namespace, podName, ['cat', '/projects/marker.txt']);
        expect(content).to.equal('synced-content');
    });

    test('sync() removes a deleted local file from the running container', async function () {
        await fs.rm(path.join(componentPath, 'marker.txt'));

        await platform.sync(session!, [], ['marker.txt']);

        const podName = await Oc.Instance.getComponentPod(COMPONENT_NAME);
        let stillExists = true;
        try {
            await execCapture(kc, namespace, podName, ['test', '-e', '/projects/marker.txt']);
        } catch {
            stillExists = false;
        }
        expect(stillExists).to.be.false;
    });

    test('restartRunCommand() restarts the run command, leaving it reachable again', async function () {
        await platform.restartRunCommand(session!);

        // give the restarted server a moment to rebind the port
        await new Promise(resolve => setTimeout(resolve, 2000));

        const response = await connectAndRead(session!.forwardedPorts[0].localPort);
        expect(response).to.equal('hello');
    });

    test('stop() tears down the Deployment', async function () {
        await platform.stop(session!);
        session = undefined;

        // Check the Deployment itself, by exact name/namespace, rather than getComponentPod()
        // (which searches the *ambient* current namespace via broad label-selector fallbacks —
        // an indirect, ambiguous signal compared to directly checking what stop() actually
        // deletes). Deployment deletion is asynchronous, so poll rather than checking once
        // immediately.
        const deadline = Date.now() + 30000;
        let stillExists = true;
        while (stillExists && Date.now() < deadline) {
            try {
                await Oc.Instance.getKubernetesObject('deployment', COMPONENT_NAME, namespace);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch {
                stillExists = false;
            }
        }
        expect(stillExists).to.be.false;
    });
});
