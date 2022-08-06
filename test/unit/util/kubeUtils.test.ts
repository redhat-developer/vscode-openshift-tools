/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import path = require('path');
import { KubeConfigUtils } from '../../../src/util/kubeUtils';

const {expect} = chai;
chai.use(sinonChai);

suite('K8s Configuration Utility', () => {
    let sandbox: sinon.SinonSandbox;
    const homeDir = path.resolve(__dirname, '..', '..', '..', '..', 'test', 'fixtures');
    const configDir = path.resolve(homeDir,'.kube');

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('loads configs listed in KUBECONFIG evn variable', () => {
        sandbox.stub(process, 'env').value({
            'KUBECONFIG': [path.join(configDir, 'config'), path.join(configDir, 'config1')].join(path.delimiter)
        });
        const kc = new KubeConfigUtils();
        expect(kc.getProxy('context-cluster5')).is.not.undefined;
        expect(kc.getProxy('context-cluster4')).is.undefined;
    });

    test('loads ~/.kube/config', () => {
        sandbox.stub(KubeConfigUtils.prototype, 'findHomeDir').returns(homeDir);
        const kc = new KubeConfigUtils();
        expect(kc.getProxy('context-cluster1')).is.not.undefined;
    })
});