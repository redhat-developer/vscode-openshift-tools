/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { InputBox, VSBrowser, Workbench } from 'vscode-extension-tester';

 export async function activateCommand(command: string){
    const prompt = await new Workbench().openCommandPrompt() as InputBox;

    // openCommandPrompt() can return a reference to the palette input before it's actually
    // interactable (e.g. under CI load) - typing into it immediately then throws
    // ElementNotInteractableError. Wait for it to actually be displayed first.
    await VSBrowser.instance.driver.wait(async () => {
        try {
            return await prompt.isDisplayed();
        } catch {
            return false;
        }
    }, 10_000, 'Command prompt did not become interactable');

    await prompt.setText(command);
    await prompt.confirm();

 }