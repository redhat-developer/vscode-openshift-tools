/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    ActivityBar,
    BottomBarPanel,
    CallStackItem,
    DebugView,
    EditorView,
    Key,
    SideBarView,
    ViewItem,
    ViewSection,
    VSBrowser,
} from 'vscode-extension-tester';
import { MENUS, VIEWS } from '../common/constants';
import { itemDoesNotExist, itemExists, notificationDoesNotExist } from '../common/conditions';
import { OpenshiftTerminalWebviewView } from '../common/ui/webviewView/openshiftTerminalWebviewView';
import { expect } from 'chai';
import { collapse } from '../common/overdrives';

export function testComponentContextMenu() {
    describe('Component Context Menu', function () {
        this.timeout(60_000);
        let view: SideBarView;
        let section: ViewSection;
        let component: ViewItem;
        let openshiftTerminal: OpenshiftTerminalWebviewView;

        const componentName = 'nodejs-starter';
        const expectedTabName = `odo dev: ${componentName}`;

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
                await (await view.getContent().getSection(item)).collapse();
            }

            section = await view.getContent().getSection(VIEWS.components);
        });

        it('Start Dev works', async function () {
            this.timeout(60_000);

            //start dev
            await startDev(true);

            //check openshift terminal for tab name
            openshiftTerminal = new OpenshiftTerminalWebviewView();
            const terminalName = await openshiftTerminal.getActiveTabName();
            expect(terminalName).to.contain(expectedTabName);

            //decline odo telemetry
            await openshiftTerminal.sendKeysToTerminal(['n', Key.ENTER]);

            //wait for start dev to finish
            await waitForStartDevToFinish(true);

            //check terminal content
            const terminalText = await openshiftTerminal.getTerminalText();
            expect(terminalText).to.contain(`Developing using the "${componentName}" Devfile`);
            expect(terminalText).to.contain('Running on the cluster in Dev mode');
            expect(terminalText).to.contain('Pod is Running');
            expect(terminalText).to.contain('Waiting for the application to be ready');
            expect(terminalText).to.contain('Keyboard Commands');
        });

        it('Stop Dev works', async function () {
            this.timeout(80_000);

            //stop dev
            await stopDev();

            //wait for dev to stop
            await waitForStopDevToFinish(true);

            //check for terminal content
            const terminalText = await openshiftTerminal.getTerminalText();
            expect(terminalText).to.include('Finished executing the application');
            expect(terminalText).to.include('Press any key to close this terminal');

            //close tab and check
            await openshiftTerminal.sendKeysToTerminal([Key.ENTER]);
            expect(await openshiftTerminal.isAnyTabOpened()).to.be.false;
        });

        it('Stop Dev works by pressing Ctrl+c', async function () {
            this.timeout(80_000);

            //start dev
            await startDev(true);

            //wait for start dev to finish
            await waitForStartDevToFinish(true);

            //stop dev
            await openshiftTerminal.sendKeysToTerminal([`${Key.CONTROL}c`]);

            //wait for stop dev to finish
            await waitForStopDevToFinish(true);

            //check for terminal content
            const terminalText = await openshiftTerminal.getTerminalText();
            expect(terminalText).to.include('Finished executing the application');
            expect(terminalText).to.include('Press any key to close this terminal');
        });

        it('Start/Stop Dev on Podman works', async () => {
            this.timeout(80_000);

            //start dev on podman
            await startDev(false);

            //wait for start dev to finish
            await waitForStartDevToFinish(false);

            //check for terminal content
            let terminalText = await openshiftTerminal.getTerminalText();
            expect(terminalText).to.contain('Platform: podman');

            //stop dev
            await stopDev();

            //wait for stop dev to finish
            await waitForStopDevToFinish(false);

            //check for terminal content
            terminalText = await openshiftTerminal.getTerminalText();
            expect(terminalText).to.include('context canceled');
            expect(terminalText).to.include('Cleaning up resources');
            expect(terminalText).to.include('Press any key to close this terminal');
        });

        it('Describe component works', async () => {
            this.timeout(80_000);

            //start dev
            await startDev(true);

            //wait for start dev to finish
            await waitForStartDevToFinish(true);

            //describe component
            const contextMenu = await component.openContextMenu();
            await contextMenu.select(MENUS.describe);

            //check tab name
            const tabName = await openshiftTerminal.getActiveTabName();
            expect(tabName).to.contain(`Describe '${componentName}' Component`);

            //Check for terminal content
            //await new Promise((res) => { setTimeout(res, 1_500) });
            const terminalText = await openshiftTerminal.getTerminalText();
            expect(terminalText).to.contain('Name');
            expect(terminalText).to.contain('Display Name');
            expect(terminalText).to.contain('Project Type');
            expect(terminalText).to.contain('Language');
            expect(terminalText).to.contain('Version');
            expect(terminalText).to.contain('Description');
            expect(terminalText).to.contain('Tags');
            expect(terminalText).to.contain('Container components');
            expect(terminalText).to.contain('Kubernetes components');
        });

        it('Show dev terminal works', async () => {
            //open menu and select show dev terminal
            const contextMenu = await component.openContextMenu();
            await contextMenu.select(MENUS.showDevTerminal);

            //check for active tab
            const tabName = await openshiftTerminal.getActiveTabName();
            expect(tabName).to.contain(expectedTabName);
        });

        it('Show log works', async () => {
            //open menu and select show log
            const contextMenu = await component.openContextMenu();
            await contextMenu.select(MENUS.showLog);

            //check for active tab name
            const tabName = await openshiftTerminal.getActiveTabName();
            expect(tabName).to.contain(`Show '${componentName}' Component Log`);

            //check for terminal content
            const terminalText = await openshiftTerminal.getTerminalText();
            expect(terminalText).to.contain('runtime: App started on PORT');
            expect(terminalText).to.contain('Press any key to close this terminal');
        });

        it('Follow log works', async () => {
            //open menu and select follow log
            const contextMenu = await component.openContextMenu();
            await contextMenu.select(MENUS.followLog);

            //check for active tab name
            const tabName = await openshiftTerminal.getActiveTabName();
            expect(tabName).to.contain(`Follow '${componentName}' Component Log`);

            //check for terminal text
            const terminalText = await openshiftTerminal.getTerminalText();
            expect(terminalText).to.contain('runtime: App started on PORT');
            expect(terminalText).not.to.contain('Press any key to close this terminal');
        });

        it('Debug works', async () => {
            //select debug from component's context menu
            const contextMenu = await component.openContextMenu();
            await contextMenu.select(MENUS.debug);

            //wait until debug starting notification disappears
            await notificationDoesNotExist(
                `Starting debugger session for the component ${componentName}.`,
                VSBrowser.instance.driver,
            );

            //open debug console view
            const bottomBar = new BottomBarPanel();
            await bottomBar.openDebugConsoleView();

            //wait for console to have text
            await new Promise((res) => setTimeout(res, 1_000));
            const bottomBarText = await bottomBar.getText();
            expect(bottomBarText).to.contain('App started on PORT');

            //Check side bar view has been switched from openshift to run and debug
            const activityBar = new ActivityBar();
            const openshiftControl = await activityBar.getViewControl(VIEWS.openshift);
            expect(await openshiftControl.isSelected()).to.be.false;

            //open openshift view, get debug session view and click on debugged component
            let openshiftView = await openshiftControl.openView();
            let debugSession = await openshiftView.getContent().getSection(VIEWS.debugSessions);

            //refresh section
            await debugSession.expand();
            await collapse(debugSession);
            await debugSession.expand();

            //click on item
            const item = await debugSession.findItem(componentName);
            await item.click();

            //get call stack section view
            const debugView = new DebugView();
            const callStackSection = await debugView.getCallStackSection();

            //check item exists and end debugging by clicking on disconnect
            const debugItem = await itemExists(
                `Attach to '${componentName}' component.: Remote Process [0] (${componentName})`,
                callStackSection
            ) as CallStackItem;
            const disconnectButton = await debugItem.getActionButton('Disconnect (Shift+F5)');
            await disconnectButton.click();

            //open openshift view again and get debug sessions view
            openshiftView = await openshiftControl.openView();
            debugSession = await openshiftView.getContent().getSection(VIEWS.debugSessions);

            //check view is empty
            await itemDoesNotExist(componentName, debugSession);
        });

        async function startDev(devOnCluster: boolean): Promise<void> {
            component = await itemExists(componentName, section);
            const contextMenu = await component.openContextMenu();
            const option = devOnCluster ? MENUS.startDev : MENUS.startDevPodman;
            await contextMenu.select(option);
        }

        async function waitForStartDevToFinish(devOnCluster: boolean): Promise<void> {
            const podmanString = devOnCluster ? '' : ' on podman';
            await itemExists(`${componentName} (dev starting${podmanString})`, section);
            await itemExists(`${componentName} (dev running${podmanString})`, section, 30_000);
        }

        async function stopDev(): Promise<void> {
            const contextMenu = await component.openContextMenu();
            await contextMenu.select(MENUS.stopDev);
        }

        async function waitForStopDevToFinish(devOnCluster: boolean): Promise<void> {
            if (devOnCluster) {
                await itemExists(`${componentName} (dev stopping)`, section);
            }
            await itemExists(componentName, section, 60_000);
        }
    });
}
