/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/*
TODO:
Parser for available commands in package.json
Test individual commands
*/

import { expect } from 'chai';
import { InputBox, Workbench } from 'vscode-extension-tester';
import { COMMANDS } from '../common/constants';

export function checkCommandPaletteOffering() {
    describe('Command Palette', () => {
        let prompt: InputBox;

        before(async () => {
            prompt = await new Workbench().openCommandPrompt() as InputBox;
            await prompt.setText('>OpenShift');
        });

        it('Shows available commands', async () => {
            expect((await prompt.getQuickPicks()).length > 1);
        });

        describe('Available Commands', () => {
            COMMANDS.forEach(command =>
                it(command, async () => {
                    expect(await prompt.findQuickPick(command)).not.undefined;
                })
            )
        });
    });
}