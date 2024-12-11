/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { fail } from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import { KubeConfigUtils } from '../../../src/util/kubeUtils';
import { loadChaiImports } from '../../moduleImports';

suite('K8s Configuration Utility', () => {
    let expect: Chai.ExpectStatic;

    let sandbox: sinon.SinonSandbox;
    const homeDir = path.resolve(__dirname, '..', '..', '..', '..', 'test', 'fixtures');
    const configDir = path.resolve(homeDir,'.kube');

    setup(async () => {
        await loadChaiImports().then((chai) => { expect = chai.expect; }).catch(fail);

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