/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { KubeConfig } from '@kubernetes/client-node';
import { KubeConfigInfo } from '../../../src/util/kubeUtils';
import { BindingRecord, loadBindingRecords, removeBindingRecord, saveBindingRecord } from '../../../src/k8s/servicebinding/bindingStateFile';

function makeRecord(overrides: Partial<BindingRecord> = {}): BindingRecord {
    return {
        name: 'my-db',
        mode: 'projection',
        secretName: 'db-secret',
        service: {
            apiVersion: 'example.dev/v1beta1',
            kind: 'Database',
            name: 'db1',
            namespace: 'test-ns',
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

suite('Service Binding State File', () => {
    let sandbox: sinon.SinonSandbox;
    let componentPath: string;
    let getEffectiveKubeConfigStub: sinon.SinonStub;
    let findContextStub: sinon.SinonStub;

    function stubContext(server: string, namespace: string): void {
        const fakeKubeConfig = {
            currentContext: 'test-context',
            getCurrentCluster: () => ({ server }),
            makeApiClient: () => undefined,
        } as unknown as KubeConfig;

        getEffectiveKubeConfigStub.returns(fakeKubeConfig);
        findContextStub.returns({
            name: 'test-context',
            cluster: 'cluster',
            user: 'user',
            namespace,
        });
    }

    setup(() => {
        sandbox = sinon.createSandbox();
        componentPath = fs.mkdtempSync(path.join(os.tmpdir(), 'bindstate-'));
        getEffectiveKubeConfigStub = sandbox.stub(KubeConfigInfo.prototype, 'getEffectiveKubeConfig');
        findContextStub = sandbox.stub(KubeConfigInfo.prototype, 'findContext');
        stubContext('https://cluster-a', 'ns-a');
    });

    teardown(() => {
        sandbox.restore();
        fs.rmSync(componentPath, { recursive: true, force: true });
    });

    test('round-trips a record', async () => {
        await saveBindingRecord(componentPath, makeRecord());

        const records = await loadBindingRecords(componentPath);

        expect(records).to.have.lengthOf(1);
        expect(records[0]).to.deep.equal(makeRecord());
    });

    test('writes to .openshift-toolkit/bindstate.json', async () => {
        await saveBindingRecord(componentPath, makeRecord());

        const stateFile = path.join(componentPath, '.openshift-toolkit', 'bindstate.json');
        expect(fs.existsSync(stateFile)).to.be.true;
        expect((JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as any).version).to.equal(1);
    });

    test('upserts a record by name', async () => {
        await saveBindingRecord(componentPath, makeRecord());
        await saveBindingRecord(componentPath, makeRecord({ secretName: 'new-secret' }));

        const records = await loadBindingRecords(componentPath);

        expect(records).to.have.lengthOf(1);
        expect(records[0].secretName).to.equal('new-secret');
    });

    test('removes a record by name', async () => {
        await saveBindingRecord(componentPath, makeRecord({ name: 'first' }));
        await saveBindingRecord(componentPath, makeRecord({ name: 'second' }));

        await removeBindingRecord(componentPath, 'first');

        const records = await loadBindingRecords(componentPath);

        expect(records.map((record) => record.name)).to.deep.equal(['second']);
    });

    test('returns an empty list when no state exists', async () => {
        expect(await loadBindingRecords(componentPath)).to.be.empty;
    });

    test('isolates bindings per cluster/namespace context', async () => {
        await saveBindingRecord(componentPath, makeRecord());

        stubContext('https://cluster-b', 'ns-a');
        expect(await loadBindingRecords(componentPath)).to.be.empty;

        stubContext('https://cluster-a', 'ns-b');
        expect(await loadBindingRecords(componentPath)).to.be.empty;

        stubContext('https://cluster-a', 'ns-a');
        expect(await loadBindingRecords(componentPath)).to.have.lengthOf(1);
    });

    test('tolerates a corrupted state file', async () => {
        fs.mkdirSync(path.join(componentPath, '.openshift-toolkit'), { recursive: true });
        fs.writeFileSync(
            path.join(componentPath, '.openshift-toolkit', 'bindstate.json'),
            'not json',
            'utf-8',
        );

        expect(await loadBindingRecords(componentPath)).to.be.empty;

        await saveBindingRecord(componentPath, makeRecord());
        expect(await loadBindingRecords(componentPath)).to.have.lengthOf(1);
    });
});
