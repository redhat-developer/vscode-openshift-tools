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
    before(async () => {
        browser = VSBrowser.instance;
        await browser.waitForWorkbench();
    });

    // test whatever we want using webdriver, here we are just checking the page title
    it('OpenShift Connector installed and activated', async () => {
        const control = new ActivityBar().getViewControl('OpenShift');
        // eslint-disable-next-line no-console
        expect(control.getTitle()).equals('OpenShift');
    });

    it('odo command is downloaded and functional', async () => {
        const wb = new Workbench();
        const terminalView: TerminalView = await new BottomBarPanel().openTerminalView();
        wb.executeCommand('OpenShift: About');
        browser.driver.sleep(20000);
        const odoVersion = await terminalView.getText();
        expect(odoVersion).contains('odo v1.1.1');
    })

    it('oc command is downloaded and functional', async () => {
        const wb = new Workbench();
        const terminalView: TerminalView = await new BottomBarPanel().openTerminalView();
        wb.executeCommand('OpenShift: Print OKD Client Tool Version');
        browser.driver.sleep(20000);
        const ocVersion = await terminalView.getText();
        expect(ocVersion).contains('Client Version: 4.3.3');
    })
});
