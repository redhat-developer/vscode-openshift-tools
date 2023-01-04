/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { InputBox, Workbench } from 'vscode-extension-tester';

 export async function activateCommand(command: string){
    const prompt = await new Workbench().openCommandPrompt() as InputBox;
    await prompt.setText(command);
    await prompt.confirm();

 }