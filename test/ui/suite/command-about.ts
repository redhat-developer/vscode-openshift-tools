/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { By, EditorView, Key, WebElement, WebviewView, Workbench } from 'vscode-extension-tester';
import { activateCommand } from '../common/command-activator';
import { expect } from 'chai';

export function checkAboutCommand() {
    describe('About Command', () => {
        const command = '>OpenShift: About';
        //const expectedTerminalName = 'OpenShift: Show odo Version';
        const odoVersion = 'odo v3';

        let webviewView: WebviewView;
        let terminalInstance: WebElement;

        before(async () => {
            await new EditorView().closeAllEditors();
            await activateCommand(command);
        })

        // Pending on https://github.com/redhat-developer/vscode-extension-tester/pull/855
        it('New terminal opens', async function() {
            this.timeout(60_000);
            await new Promise(res => setTimeout(res, 3_000));
            await new Workbench().executeCommand('Openshift Terminal: Focus on OpenShift Terminal View');
            webviewView = new WebviewView();
            await webviewView.switchToFrame(6_500);
            terminalInstance = await webviewView.findWebElement(By.xpath('//textarea[@aria-label = "Terminal input"]'));
        });

        // Pending on https://github.com/redhat-developer/vscode-extension-tester/pull/855
        it('Terminal shows according information', async function() {
            this.timeout(60_000);
            await terminalInstance.click();

            await terminalInstance.sendKeys(`${Key.CONTROL}${Key.SHIFT}a`);
            await terminalInstance.sendKeys(`${Key.CONTROL}${Key.SHIFT}c`);
            await webviewView.switchBack();

            const cb = await import('clipboardy');
            const clipboard = await cb.read();
            expect(clipboard).to.contain(odoVersion);
        });
    });
}
