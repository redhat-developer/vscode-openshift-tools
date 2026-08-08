/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import * as sinon from 'sinon';
import { CliChannel } from '../../../src/cli';
import { Oc } from '../../../src/oc/ocWrapper';

suite('Bindable Services', () => {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        execStub = sandbox.stub(CliChannel.getInstance(), 'executeTool');
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('getBindableKinds()', () => {
        test('returns bindable kinds', async () => {
            execStub.resolves({
                stdout: JSON.stringify({
                    status: [
                        {
                            group: 'rabbitmq.com',
                            version: 'v1beta1',
                            kind: 'RabbitmqCluster',
                        },
                    ],
                }),
            });

            const result = await Oc.Instance.getBindableKinds();

            expect(result).to.deep.equal({
                status: [
                    {
                        group: 'rabbitmq.com',
                        version: 'v1beta1',
                        kind: 'RabbitmqCluster',
                    },
                ],
            });
        });

        test('returns empty status when status is missing', async () => {
            execStub.resolves({
                stdout: '{}',
            });

            const result = await Oc.Instance.getBindableKinds();

            expect(result).to.deep.equal({
                status: [],
            });
        });

        test('returns empty status when oc command fails', async () => {
            execStub.rejects(new Error('oc failed'));

            const result = await Oc.Instance.getBindableKinds();

            expect(result).to.deep.equal({
                status: [],
            });
        });

        test('rethrows non-Error value', async () => {
            execStub.rejects('failure');

            try {
                await Oc.Instance.getBindableKinds();
                expect.fail('Expected getBindableKinds() to throw');
            } catch (error) {
                expect(error).to.equal('failure');
            }
        });
    });

    suite('getApiResourceList()', () => {
        test('returns api resource list', async () => {
            execStub.resolves({
                stdout: JSON.stringify({
                    resources: [
                        {
                            name: 'rabbitmqclusters',
                            kind: 'RabbitmqCluster',
                        },
                    ],
                }),
            });

            const result = await Oc.Instance.getApiResourceList('rabbitmq.com', 'v1beta1');

            expect(result).to.deep.equal({
                resources: [
                    {
                        name: 'rabbitmqclusters',
                        kind: 'RabbitmqCluster',
                    },
                ],
            });
        });

        test('returns empty resources when oc command fails', async () => {
            execStub.rejects(new Error('oc failed'));

            const result = await Oc.Instance.getApiResourceList('rabbitmq.com', 'v1beta1');

            expect(result).to.deep.equal({
                resources: [],
            });
        });

        test('rethrows non-Error value', async () => {
            execStub.rejects('failure');

            try {
                await Oc.Instance.getApiResourceList('rabbitmq.com', 'v1beta1');
                expect.fail('Expected getApiResourceList() to throw');
            } catch (error) {
                expect(error).to.equal('failure');
            }
        });
    });
});
