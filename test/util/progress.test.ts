/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { Progress } from '../../src/util/progress';
import * as vscode from 'vscode';
import { OdoImpl } from '../../src/odo';

const expect = chai.expect;
chai.use(sinonChai);

suite('Progress Utility', () => {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    const options = {
        cancellable: false,
        location: vscode.ProgressLocation.Notification,
        title: `Testing Progress`
    };
    const command1 = { command: 'command one', increment: 50};
    const command2 = { command: 'command two', increment: 50};
    const steps = [ command1, command2 ];
    const errorMessage = 'An error';

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('calls cli commands in sequence', async () => {
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({ error: undefined, stdout: "", stderr: "" });
        await Progress.execWithProgress(options, steps, OdoImpl.getInstance());

        expect(execStub).calledTwice;
        expect(execStub.getCall(0).args[0]).equals(command1.command);
        expect(execStub.getCall(1).args[0]).equals(command2.command);
    });

    test('calls progress with given options', async () => {
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({ error: undefined, stdout: "", stderr: "" });
        const spy = sandbox.spy(vscode.window, 'withProgress');
        await Progress.execWithProgress(options, steps, OdoImpl.getInstance());

        expect(spy).calledOnceWith(options, sinon.match.func);
    });

    test('throw an error if a command fails', async () => {
        const error = new Error(errorMessage);
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').rejects(error);
        const spy = sandbox.spy(vscode.window, 'showErrorMessage');
        let e;
        try {
            await Progress.execWithProgress(options, steps, OdoImpl.getInstance());
        } catch (err)  {
            e = err;
            expect(err.message).equals(errorMessage);
        }
        if (!e) {
            expect.fail('no error thrown');
        }
    });
});