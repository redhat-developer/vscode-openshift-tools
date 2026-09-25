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
import { pushFiles, removeFiles } from '../../../src/devfile/inner-loop/containerSync';
import { createTestPod, deleteTestNamespace, deleteTestPod, ensureTestNamespace, TEST_NAMESPACE } from './testPod';

const TARGET_DIR = '/tmp/sync-test';

async function execCapture(kc: KubeConfig, podName: string, command: string[]): Promise<string> {
    const exec = new Exec(kc);
    const chunks: Buffer[] = [];
    const stdout = new Writable({
        write(chunk, _encoding, callback) {
            chunks.push(Buffer.from(chunk));
            callback();
        },
    });

    await new Promise<void>((resolve, reject) => {
        exec.exec(TEST_NAMESPACE, podName, 'main', command, stdout, null, null, false, (status) => {
            if (status.status === 'Failure') {
                reject(new Error(status.message ?? 'command failed'));
            } else {
                resolve();
            }
        }).catch(reject);
    });

    return Buffer.concat(chunks).toString('utf-8');
}

suite('devfile/inner-loop/containerSync.ts', function () {
    this.timeout(120000);

    const podName = 'container-sync-test-pod';
    let kc: KubeConfig;
    let localRoot: string;

    suiteSetup(async function () {
        kc = new KubeConfig();
        kc.loadFromDefault();

        await ensureTestNamespace();
        await createTestPod(podName);
        await execCapture(kc, podName, ['mkdir', '-p', TARGET_DIR]);
    });

    suiteTeardown(async function () {
        await deleteTestPod(podName);
        await deleteTestNamespace();
    });

    setup(async function () {
        localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'container-sync-test-'));
    });

    teardown(async function () {
        await fs.rm(localRoot, { recursive: true, force: true });
    });

    test('pushFiles copies local files (including nested paths) into the container', async function () {
        await fs.writeFile(path.join(localRoot, 'hello.txt'), 'hello from sync test');
        await fs.mkdir(path.join(localRoot, 'nested'));
        await fs.writeFile(path.join(localRoot, 'nested', 'inner.txt'), 'nested content');

        await pushFiles(kc, TEST_NAMESPACE, podName, 'main', localRoot, TARGET_DIR, ['hello.txt', 'nested/inner.txt']);

        const content = await execCapture(kc, podName, ['cat', `${TARGET_DIR}/hello.txt`]);
        expect(content).to.equal('hello from sync test');

        const nestedContent = await execCapture(kc, podName, ['cat', `${TARGET_DIR}/nested/inner.txt`]);
        expect(nestedContent).to.equal('nested content');
    });

    test('pushFiles is a no-op for an empty file list', async function () {
        await pushFiles(kc, TEST_NAMESPACE, podName, 'main', localRoot, TARGET_DIR, []);
    });

    test('removeFiles deletes previously synced files from the container', async function () {
        await fs.writeFile(path.join(localRoot, 'to-delete.txt'), 'delete me');
        await pushFiles(kc, TEST_NAMESPACE, podName, 'main', localRoot, TARGET_DIR, ['to-delete.txt']);

        await removeFiles(kc, TEST_NAMESPACE, podName, 'main', TARGET_DIR, ['to-delete.txt']);

        let stillExists = true;
        try {
            await execCapture(kc, podName, ['test', '-e', `${TARGET_DIR}/to-delete.txt`]);
        } catch {
            stillExists = false;
        }
        expect(stillExists).to.be.false;
    });

    test('removeFiles is a no-op for an empty path list', async function () {
        await removeFiles(kc, TEST_NAMESPACE, podName, 'main', TARGET_DIR, []);
    });
});
