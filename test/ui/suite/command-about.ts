/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { By, EditorView, WebviewView, Workbench } from 'vscode-extension-tester';
import { activateCommand } from '../common/command-activator';
import { OpenshiftTerminalWebviewView } from '../common/ui/webviewView/openshiftTerminalWebviewView';
import bundledTools from '../../../src/tools.json';

export function checkAboutCommand(clusterIsSet: boolean) {
    describe('About Command', () => {
        const command = '>OpenShift: About';
        const noClusterMessage = 'Not connected';
        const clusterServer = 'https://127.0.0.1';

        let webviewView: WebviewView;
        let openshiftTerminal: OpenshiftTerminalWebviewView;

        before(async () => {
            await new EditorView().closeAllEditors();
            await activateCommand(command);
        });

        after(async () => {
            await openshiftTerminal.closeTab('About OpenShift Tools');
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

            if (!clusterIsSet) {
                expect(terminalText).to.contain(noClusterMessage);
            } else {
                expect(terminalText).to.contain(clusterServer);
            }

            // --- Header ---
            expect(terminalText).to.contain('OpenShift Tools');

            // --- Core sections ---
            expect(terminalText).to.contain('OpenShift Client');
            expect(terminalText).to.contain('Cluster');
            expect(terminalText).to.contain('Container Runtime');
            expect(terminalText).to.contain('Bundled Tools');
            expect(terminalText).to.contain('Not Bundled Tools');
            expect(terminalText).to.contain('CRC Tool');

            // --- OpenShift CLI ---
            expect(terminalText).to.contain('oc Version');

            // --- Runtime tools ---
            expect(terminalText).to.contain('Podman');
            expect(terminalText).to.contain('Docker');

            // --- Cluster state validation ---
            if (!clusterIsSet) {
                expect(terminalText).to.contain(noClusterMessage);
            } else {
                expect(terminalText).to.contain('Server');
                expect(terminalText).to.contain('Context');
                expect(terminalText).to.contain('Kubernetes');

                expect(terminalText).to.contain(clusterServer);
            }

            // --- Bundled tools version validation ---
            // Dynamically get list of bundled CLI tools that have cmdFileName property
            // Exclude alizer as its binary version doesn't match tools.json version
            const bundledToolNames = Object.keys(bundledTools).filter(
                toolName => bundledTools[toolName].cmdFileName &&
                           toolName !== 'alizer'
            );

            for (const toolName of bundledToolNames) {
                const toolConfig = bundledTools[toolName];
                if (toolConfig && toolConfig.version) {
                    const expectedVersion = toolConfig.version;

                    // Check that the tool appears in the terminal
                    expect(terminalText).to.contain(
                        toolName,
                        `Expected bundled tool '${toolName}' to be shown in terminal`
                    );

                    // Check that the tool name and version appear together on the same line
                    // Format: "toolname            : version" or "toolname            : Unknown"
                    // Escape special regex characters in version string to prevent regex injection
                    const escapedVersion = expectedVersion.replace(/[\\.*+?^${}()|[\]]/g, '\\$&');
                    const toolLineRegex = new RegExp(`${toolName}\\s*:\\s*${escapedVersion}`);
                    const unknownLineRegex = new RegExp(`${toolName}\\s*:\\s*Unknown`);

                    const hasExpectedVersion = toolLineRegex.test(terminalText);
                    const hasUnknownVersion = unknownLineRegex.test(terminalText);

                    expect(hasExpectedVersion || hasUnknownVersion,
                        `Expected bundled tool '${toolName}' to show version ${expectedVersion} or "Unknown" in terminal`
                    ).to.be.true;
                }
            }

        });
    });
}
