/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl } from '../../../src/odo';
import { Command } from '../../../src/odo/command';
import { Catalog } from '../../../src/openshift/catalog';
import { Platform } from '../../../src/util/platform';

const {expect} = chai;
chai.use(sinonChai);

suite('OpenShift/Catalog', () => {
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

        expect(execStub).calledOnceWith(Command.listCatalogServices(), Platform.getUserHomePath());
    });
});
