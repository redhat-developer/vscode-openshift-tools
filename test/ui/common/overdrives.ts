/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { ViewSection, By, waitForAttributeValue, BottomBarPanel, VSBrowser, ActivityBar } from 'vscode-extension-tester';
import { activateCommand } from './command-activator';
import { VIEWS } from './constants';

export async function collapse(section: ViewSection) {
    try {
        await section.collapse();
    } catch {
        if (await section.isExpanded()) {
            const mainPanel = await section.findElement(By.className('pane-header'));
            const arrowPanel = await section.findElement(By.className('codicon'));
            await arrowPanel.click();
            await section
                .getDriver()
                .wait(waitForAttributeValue(mainPanel, 'aria-expanded', 'false'), 2_000);
        }
    }
}

/**
 * Closes BottomBarPanel and reloads window so openshift terminal is not loaded,
 * then waits until window is loaded.
 * Fixes issue where openshift terminal stoles focus during work with other webviews
 */
export async function reloadWindow() {
    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);
    await activateCommand('>Developer: Reload Window');
    await VSBrowser.instance.waitForWorkbench();

    //wait for Activity Bar to be loaded
    await VSBrowser.instance.driver.wait(async () => {
        try {
            const viewControl = await new ActivityBar().getViewControl(VIEWS.openshift);
            if (viewControl) {
                return true;
            }
        } catch {
            return null;
        }
    });
}
