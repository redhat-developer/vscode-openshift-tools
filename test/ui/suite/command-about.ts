/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { By, EditorView, WebviewView, Workbench } from 'vscode-extension-tester';
import { activateCommand } from '../common/command-activator';
import { expect } from 'chai';
import { OpenshiftTerminalWebviewView } from '../common/ui/webviewView/openshiftTerminalWebviewView';

export function checkAboutCommand(clusterIsSet: boolean) {
    describe('About Command', () => {
        const command = '>OpenShift: About';
        const odoVersion = 'odo v3';
        const noClusterMessage = 'unable to fetch the cluster server version';
        const clusterServer = 'https://127.0.0.1';

        let webviewView: WebviewView;
        let openshiftTerminal: OpenshiftTerminalWebviewView;

        before(async () => {
            await new EditorView().closeAllEditors();
            await activateCommand(command);
        });

        after(async () => {
            await openshiftTerminal.closeTab('Show odo Version');
        });

        it('New terminal opens', async function() {
            this.timeout(60_000);
            await new Promise((res) => setTimeout(res, 3_000));
            await new Workbench().executeCommand(
                'Openshift Terminal: Focus on OpenShift Terminal View',
            );
            webviewView = new WebviewView();
            await webviewView.switchToFrame(6_500);
            await webviewView.findWebElement(
                By.xpath('//textarea[@aria-label = "Terminal input"]'),
            );
            await webviewView.switchBack();
        });

        it('Terminal shows according information', async function() {
            this.timeout(60_000);
            openshiftTerminal = new OpenshiftTerminalWebviewView();

            const terminalText = await openshiftTerminal.getTerminalText();

            expect(terminalText).to.contain(odoVersion)
            if (!clusterIsSet) {
                expect(terminalText).to.contain(noClusterMessage);
            } else {
                expect(terminalText).to.contain(clusterServer);
            }
        });
    });
}
