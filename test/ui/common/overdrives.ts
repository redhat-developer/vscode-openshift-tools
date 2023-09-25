/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { ViewSection, By, waitForAttributeValue } from 'vscode-extension-tester';

export async function collapse(section: ViewSection){
    try {
        await section.collapse();
    } catch {
        if (await section.isExpanded()) {
            const mainPanel = await section.findElement(By.className('pane-header'));
            const arrowPanel = await section.findElement(By.className('codicon'));
            await arrowPanel.click();
            await section.getDriver().wait(waitForAttributeValue(mainPanel, 'aria-expanded', 'false'), 2_000);
        }
    }
}
