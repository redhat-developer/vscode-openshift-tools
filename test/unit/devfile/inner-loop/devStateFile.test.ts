/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { DevState } from '../../../../src/devfile/componentTypeDescription';
import { clearDevState, loadDevState, saveDevState } from '../../../../src/devfile/inner-loop/devStateFile';

const { expect } = chai;

suite('devfile/inner-loop/devStateFile.ts', () => {
    let componentPath: string;

    setup(async () => {
        componentPath = await fs.mkdtemp(path.join(os.tmpdir(), 'devstate-test-'));
    });

    teardown(async () => {
        await fs.rm(componentPath, { recursive: true, force: true });
    });

    suite('loadDevState()', () => {
        test('returns null when no devstate.json exists', async () => {
            const result = await loadDevState(componentPath);
            expect(result).to.be.null;
        });

        test('returns null when devstate.json is invalid JSON', async () => {
            await fs.mkdir(path.join(componentPath, '.openshift-toolkit'), { recursive: true });
            await fs.writeFile(path.join(componentPath, '.openshift-toolkit', 'devstate.json'), 'not json', 'utf-8');

            const result = await loadDevState(componentPath);
            expect(result).to.be.null;
        });

        test('falls back to the legacy .odo location written by older extension versions', async () => {
            const state: DevState = { pid: 42, platform: 'cluster' };
            await fs.mkdir(path.join(componentPath, '.odo'), { recursive: true });
            await fs.writeFile(path.join(componentPath, '.odo', 'devstate.json'), JSON.stringify(state), 'utf-8');

            const result = await loadDevState(componentPath);
            expect(result).to.deep.equal(state);
        });

        test('prefers the .openshift-toolkit file over the legacy .odo one', async () => {
            await fs.mkdir(path.join(componentPath, '.odo'), { recursive: true });
            await fs.writeFile(path.join(componentPath, '.odo', 'devstate.json'), JSON.stringify({ pid: 1, platform: 'cluster' }), 'utf-8');
            await saveDevState({ pid: 2, platform: 'podman' }, componentPath);

            const result = await loadDevState(componentPath);
            expect(result).to.deep.equal({ pid: 2, platform: 'podman' });
        });
    });

    suite('saveDevState() / loadDevState() round-trip', () => {
        test('persists and reloads a minimal dev state', async () => {
            const state: DevState = {
                pid: process.pid,
                platform: 'cluster',
            };

            await saveDevState(state, componentPath);
            const result = await loadDevState(componentPath);

            expect(result).to.deep.equal(state);
        });

        test('persists and reloads forwarded ports and apiServerPort', async () => {
            const state: DevState = {
                pid: 1234,
                platform: 'podman',
                apiServerPort: 51234,
                forwardedPorts: [
                    {
                        containerName: 'runtime',
                        portName: 'http',
                        localAddress: '127.0.0.1',
                        localPort: 40001,
                        containerPort: 8080,
                        exposure: 'public',
                    },
                    {
                        containerName: 'runtime',
                        portName: 'debug',
                        isDebug: true,
                        localAddress: '127.0.0.1',
                        localPort: 40002,
                        containerPort: 5858,
                    },
                ],
            };

            await saveDevState(state, componentPath);
            const result = await loadDevState(componentPath);

            expect(result).to.deep.equal(state);
        });

        test('creates the .openshift-toolkit directory if it does not already exist', async () => {
            const state: DevState = { pid: 1, platform: 'cluster' };

            await saveDevState(state, componentPath);

            const stat = await fs.stat(path.join(componentPath, '.openshift-toolkit', 'devstate.json'));
            expect(stat.isFile()).to.be.true;
        });

        test('overwrites a previously saved state', async () => {
            await saveDevState({ pid: 1, platform: 'cluster' }, componentPath);
            await saveDevState({ pid: 2, platform: 'docker' }, componentPath);

            const result = await loadDevState(componentPath);
            expect(result).to.deep.equal({ pid: 2, platform: 'docker' });
        });
    });

    suite('clearDevState()', () => {
        test('removes an existing devstate.json', async () => {
            await saveDevState({ pid: 1, platform: 'cluster' }, componentPath);

            await clearDevState(componentPath);

            const result = await loadDevState(componentPath);
            expect(result).to.be.null;
        });

        test('removes a legacy .odo devstate.json', async () => {
            await fs.mkdir(path.join(componentPath, '.odo'), { recursive: true });
            await fs.writeFile(path.join(componentPath, '.odo', 'devstate.json'), JSON.stringify({ pid: 1, platform: 'cluster' }), 'utf-8');

            await clearDevState(componentPath);

            const result = await loadDevState(componentPath);
            expect(result).to.be.null;
        });

        test('does not throw when devstate.json does not exist', async () => {
            await clearDevState(componentPath);
        });
    });
});
