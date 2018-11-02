'use strict';

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl } from '../../src/odo';
import { Catalog } from '../../src/openshift/catalog';

const expect = chai.expect;
chai.use(sinonChai);

suite('Openshift/Catalog', () => {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        execStub = sandbox.stub(OdoImpl.prototype, 'executeInTerminal').resolves();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('listComponents calls odo catalog list components', () => {
        Catalog.listComponents();

        expect(execStub).calledOnceWith('odo catalog list components', process.cwd());
    });

    test('listServices calls odo catalog list services', () => {
        Catalog.listServices();

        expect(execStub).calledOnceWith('odo catalog list services', process.cwd());
    });
});