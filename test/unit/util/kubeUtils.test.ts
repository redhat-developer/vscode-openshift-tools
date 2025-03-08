/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { KubeConfigInfo } from '../../../src/util/kubeUtils';

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
        const k8sConfigInfo = new KubeConfigInfo();
        expect(k8sConfigInfo.getProxy('context-cluster5')).is.not.undefined;
        expect(k8sConfigInfo.getProxy('context-cluster4')).is.undefined;
    });

    test('loads ~/.kube/config', () => {
        sandbox.stub(process, 'env').value({
            'KUBECONFIG': undefined // Make sure the `KUBECONFIG` env. variable is unset, otherwise, the `findHomeDir()` will not be invoked
        });
        sandbox.stub(KubeConfigInfo.prototype, 'findHomeDir').returns(homeDir);
        const k8sConfigInfo = new KubeConfigInfo();
        expect(k8sConfigInfo.getProxy('context-cluster1')).is.not.undefined;
    })
});