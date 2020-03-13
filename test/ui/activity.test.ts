/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    VSBrowser,
    ActivityBar,
    Workbench,
    BottomBarPanel,
    TerminalView,
} from 'vscode-extension-tester';
import * as chai from 'chai';

const { expect } = chai;

export async function wait(timeout = 2500): Promise<void> {
    return new Promise((res) => setTimeout(res, timeout));
}

// Create a Mocha suite
describe('OpenShift Connector Smoke Test', () => {
    let browser: VSBrowser;

    // initialize the browser and webdriver
    before(() => {
        browser = VSBrowser.instance;
    });

    // test whatever we want using webdriver, here we are just checking the page title
    it('OpenShift Connector installed and activated', async () => {
        await browser.waitForWorkbench();
        const control = new ActivityBar().getViewControl('OpenShift');
        // eslint-disable-next-line no-console
        expect(control.getTitle()).equals('OpenShift');
        const wb = new Workbench();
        const terminalView: TerminalView = await new BottomBarPanel().openTerminalView();
        wb.openCommandPrompt();
        wb.executeCommand('OpenShift: About');
        await wait(10000);
        const text = await terminalView.getText();
        expect(text).contains('odo v1.1.0');
    });
});
