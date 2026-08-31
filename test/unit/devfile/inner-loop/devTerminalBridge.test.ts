/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { isStopRequest } from '../../../../src/devfile/inner-loop/devTerminalBridge';

const { expect } = chai;

suite('devfile/inner-loop/devTerminalBridge.ts', () => {

    suite('isStopRequest()', () => {
        test('detects the raw Ctrl-C control byte', () => {
            expect(isStopRequest('\u0003')).to.be.true;
        });

        test('detects the control byte embedded in a larger chunk of input', () => {
            expect(isStopRequest('some input\u0003more input')).to.be.true;
        });

        test('does not treat the printable "^C" text as a stop request', () => {
            // A real pty's line discipline echoes Ctrl-C as printable "^C" — this virtual
            // terminal has no such line discipline, so only the raw byte should count.
            expect(isStopRequest('^C')).to.be.false;
        });

        test('returns false for ordinary program output', () => {
            expect(isStopRequest('Server started on port 8080\r\n')).to.be.false;
        });

        test('returns false for empty input', () => {
            expect(isStopRequest('')).to.be.false;
        });
    });
});
