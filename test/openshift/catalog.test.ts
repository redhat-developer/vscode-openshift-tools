/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl, Command } from '../../src/odo';
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

        expect(execStub).calledOnceWith(Command.listCatalogComponents());
    });

    test('listServices calls odo catalog list services', () => {
        Catalog.listServices();

        expect(execStub).calledOnceWith(Command.listCatalogSevices());
    });
});