/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { ViewSection, By, EditorView, waitForAttributeValue, BottomBarPanel, VSBrowser, ActivityBar, SideBarView } from 'vscode-extension-tester';
import { activateCommand } from './command-activator';
import { VIEWS } from './constants';

export async function closeAllOpenEditors(): Promise<void> {
    try {
        await new EditorView().closeAllEditors();
    } catch { /* best effort */ }
}

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

// Collapses each named section of the given view, best-effort: a section that fails to
// collapse (stale reference, click intercepted by a hover, not currently found, etc.)
// is skipped rather than failing the whole suite.
export async function collapseViews(view: SideBarView, sectionTitles: string[]): Promise<void> {
    for (const sectionTitle of sectionTitles) {
        try {
            await collapse(await view.getContent().getSection(sectionTitle));
        } catch {
            // best-effort - a section failing to collapse shouldn't fail the whole suite
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
