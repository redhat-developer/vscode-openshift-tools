/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    ActivityBar,
    EditorView,
    Key,
    SideBarView,
    ViewItem,
    ViewSection,
} from 'vscode-extension-tester';
import { collapse } from '../common/overdrives';
import { MENUS, VIEWS } from '../common/constants';
import { itemExists } from '../common/conditions';
import { OpenshiftTerminalWebviewView } from '../common/ui/webviewView/openshiftTerminalWebviewView';
import { expect } from 'chai';

export function testComponentContextMenu() {
    describe('Component Context Menu', function() {
        let view: SideBarView;
        let section: ViewSection;
        let component: ViewItem;
        let openshiftTerminal: OpenshiftTerminalWebviewView;

        const componentName = 'nodejs-starter';
        const expectedTerminalName = `odo dev: ${componentName}`;

        before(async function context() {
            this.timeout(10_000);
            await new EditorView().closeAllEditors();
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            for (const item of [
                VIEWS.appExplorer,
                VIEWS.compRegistries,
                VIEWS.serverlessFunctions,
                VIEWS.debugSessions,
            ]) {
                await collapse(await view.getContent().getSection(item));
            }

            section = await view.getContent().getSection(VIEWS.components);
        });

        it('Start Dev works', async function() {
            this.timeout(60_000)
            //start dev
            component = await itemExists(componentName, section);
            const contextMenu = await component.openContextMenu();
            await contextMenu.select(MENUS.startDev);

            //check openshift terminal for tab name
            openshiftTerminal = new OpenshiftTerminalWebviewView();
            const terminalName = await openshiftTerminal.getActiveTabName();
            expect(terminalName).to.contain(expectedTerminalName)

            //decline odo telemetry
            await openshiftTerminal.sendKeysToTerminal(['n', Key.ENTER])

            //wait for start dev to finish
            await itemExists(`${componentName} (dev starting)`, section);
            await itemExists(`${componentName} (dev running)`, section, 30_000);

            //check terminal content
            const terminalText = await openshiftTerminal.getTerminalText();
            expect(terminalText).to.contain(`Developing using the "${componentName}" Devfile`);
            expect(terminalText).to.contain('Running on the cluster in Dev mode');
            expect(terminalText).to.contain('Pod is Running');
            expect(terminalText).to.contain('Waiting for the application to be ready');
            expect(terminalText).to.contain('Keyboard Commands');
        });

        it('Stop Dev works', async function() {
            this.timeout(80_000);

            //stop dev
            const contextMenu = await component.openContextMenu();
            await contextMenu.select(MENUS.stopDev);

            //wait for dev to stop
            await itemExists(`${componentName} (dev stopping)`, section);
            await itemExists(componentName, section, 60_000);

            //check for terminal content
            const terminalText = await openshiftTerminal.getTerminalText();
            expect(terminalText).to.include('Finished executing the application');
            expect(terminalText).to.include('Press any key to close this terminal');

            //close tab and check
            await openshiftTerminal.sendKeysToTerminal([Key.ENTER]);
            expect(await openshiftTerminal.isAnyTabOpened()).to.be.false;
        });

        it('Stop Dev works by pressing Ctrl+c', async function() {
            this.timeout(80_000)
            //start dev
            const contextMenu = await component.openContextMenu();
            await contextMenu.select(MENUS.startDev);

            //wait for start dev to finish
            await itemExists(`${componentName} (dev starting)`, section);
            await itemExists(`${componentName} (dev running)`, section, 30_000);

            //stop dev
            await openshiftTerminal.sendKeysToTerminal([`${Key.CONTROL}c`]);

            //wait for stop dev to finish
            await itemExists(`${componentName} (dev stopping)`, section);
            await itemExists(componentName, section, 60_000);

            //check for terminal content
            const terminalText = await openshiftTerminal.getTerminalText();
            expect(terminalText).to.include('Finished executing the application');
            expect(terminalText).to.include('Press any key to close this terminal');
        })
    });
}
