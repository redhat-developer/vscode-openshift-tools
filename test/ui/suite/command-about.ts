/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { TerminalView } from 'vscode-extension-tester';
import { activateCommand } from '../common/command-activator';

export function checkAboutCommand() {
    describe('About Command', () => {
        const command = '>OpenShift: About';
        const expectedTerminalName = 'OpenShift: Show odo Version';
        const odoVersion = 'odo v3';

        before(async () => {
            await activateCommand(command);
        })

        // Pending on https://github.com/redhat-developer/vscode-extension-tester/pull/855
        it.skip('New terminal opens', async function() {
            this.timeout(60000);
            await new Promise(res => setTimeout(res, 6000));
            const terminalName = await new TerminalView().getCurrentChannel();
            expect(terminalName).to.include(expectedTerminalName);
        });

        // Pending on https://github.com/redhat-developer/vscode-extension-tester/pull/855
        it.skip('Terminal shows according information', async function() {
            this.timeout(60000);
            const terminalText = await new TerminalView().getText();
            expect(terminalText).to.include(odoVersion);
        });
    });
}
