/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ComponentDescription, Data } from '../../../src/devfile/componentTypeDescription';
import { DevPlatformSession } from '../../../src/devfile/inner-loop/devPlatform';
import { PodmanDevPlatform } from '../../../src/devfile/inner-loop/podmanDevPlatform';
import { ChildProcessUtil } from '../../../src/util/childProcessUtil';
import { ComponentWorkspaceFolder } from '../../../src/odo/workspace';
import { connectAndRead } from './netTestUtils';

const COMPONENT_NAME = 'podman-dev-platform-it';
const CONTAINER_NAME = 'runtime';
const ENDPOINT_PORT = 8080;
const TEST_IMAGE = 'localhost/nodejs-image:latest';

function buildDevfile(): Data {
    return {
        schemaVersion: '2.2.0',
        metadata: { name: COMPONENT_NAME, version: '1.0.0' },
        components: [
            {
                name: CONTAINER_NAME,
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
                    component: CONTAINER_NAME,
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

suite('devfile/inner-loop/podmanDevPlatform.ts', function () {
    this.timeout(60000);

    const podName = `${COMPONENT_NAME}-dev`;
    let componentPath: string;
    let platform: PodmanDevPlatform;
    let session: DevPlatformSession | undefined;
    const output: string[] = [];

    suiteSetup(async function () {
        this.timeout(120000); // Allow time for image build
        componentPath = await fs.mkdtemp(path.join(os.tmpdir(), 'podman-dev-platform-test-'));
        // mkdtemp() defaults to mode 0700 (owner-only). Real component folders on disk are never
        // this restrictive, but a 0700 dir bind-mounted into a container running as a non-root
        // image user (e.g. this test image's UID 1001) is not even traversable, causing the run
        // command to fail with "Permission denied" before it can start listening.
        await fs.chmod(componentPath, 0o755);
        platform = new PodmanDevPlatform();

        // Build test image for the integration tests
        const dockerfile = `FROM node:18-alpine
WORKDIR /projects
USER 1001`;
        const dockerfilePath = path.join(componentPath, 'Dockerfile');
        await fs.writeFile(dockerfilePath, dockerfile, 'utf-8');

        const buildResult = await ChildProcessUtil.Instance.execute(
            `podman build -t ${TEST_IMAGE} -f ${dockerfilePath} ${componentPath}`
        );
        if (buildResult.error) {
            throw new Error(`Failed to build test image: ${buildResult.stderr || buildResult.error.message}`);
        }
    });

    suiteTeardown(async function () {
        if (session) {
            await platform.stop(session).catch(() => {});
        }
        await ChildProcessUtil.Instance.execute(`podman pod rm -f ${podName}`).catch(() => {});
        await ChildProcessUtil.Instance.execute(`podman rmi -f ${TEST_IMAGE}`).catch(() => {});
        await fs.rm(componentPath, { recursive: true, force: true });
    });

    test('start() creates a pod, bind-mounts the workspace, and publishes its endpoint', async function () {
        const devfile = buildDevfile();
        const componentFolder = buildComponentFolder(componentPath, devfile);

        session = await platform.start(devfile, componentFolder, {}, { onOutput: line => output.push(line) });

        expect(session.kind).to.equal('podman');
        expect(session.forwardedPorts).to.have.lengthOf(1);
        expect(session.forwardedPorts[0].containerPort).to.equal(ENDPOINT_PORT);
        expect(session.forwardedPorts[0].portName).to.equal('http');

        const response = await connectAndRead(session.forwardedPorts[0].localPort);
        expect(response).to.equal('hello');
    });

    test('sync() is a no-op — a file written on the host is already visible via bind mount', async function () {
        await fs.writeFile(path.join(componentPath, 'marker.txt'), 'synced-content');

        await platform.sync(session!, ['marker.txt'], []);

        const result = await ChildProcessUtil.Instance.execute(`podman exec ${CONTAINER_NAME} cat /projects/marker.txt`);
        if (result.error) {
            throw new Error(`podman exec failed: ${result.stderr || result.error.message}`);
        }
        expect(result.stdout).to.equal('synced-content');
    });

    test('restartRunCommand() restarts the run command, leaving it reachable again', async function () {
        await platform.restartRunCommand(session!);

        const response = await connectAndRead(session!.forwardedPorts[0].localPort);
        expect(response).to.equal('hello');
    });

    test('stop() tears down the pod', async function () {
        await platform.stop(session!);
        session = undefined;

        const result = await ChildProcessUtil.Instance.execute(`podman pod exists ${podName}`);
        expect(result.error).to.exist;
    });
});
