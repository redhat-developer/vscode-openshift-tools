/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import {
    ActivityBar,
    BottomBarPanel,
    DebugView,
    EditorView,
    Key,
    NotificationType,
    SideBarView,
    ViewSection,
    VSBrowser,
    Workbench
} from 'vscode-extension-tester';
import { findItemFuzzy, itemDoesNotExist, notificationDoesNotExist, stabilizeComponentsView, waitForItem, waitForItemStable, waitForItemToDisappear, warn } from '../common/conditions';
import { MENUS, VIEWS } from '../common/constants';
import { collapse } from '../common/overdrives';
import { OpenshiftTerminalWebviewView } from '../common/ui/webviewView/openshiftTerminalWebviewView';

export function testComponentContextMenu() {
    describe('Component Context Menu', function () {
        this.timeout(80_000);
        let view: SideBarView;
        let openshiftTerminal: OpenshiftTerminalWebviewView;

        const componentName = 'nodejs-starter';
        const expectedTabName = `odo dev: ${componentName}`;

        before(async function context() {
            this.timeout(45_000);
            await new EditorView().closeAllEditors();
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            await (await new Workbench().openNotificationsCenter()).clearAllNotifications();
            for (const item of [
                VIEWS.appExplorer,
                VIEWS.compRegistries,
                VIEWS.serverlessFunctions,
                VIEWS.debugSessions,
            ]) {
                await (await view.getContent().getSection(item)).collapse();
            }

            try {
                const item = await waitForItemStable(getSection, componentName, true, 40_000);
                if (!item) {
                    warn(`Component "${componentName}" not found, skipping tests`);
                    this.skip();
                }
            } catch (err) {
                warn('Error in before hook: "Component Context Menu":', err);
                this.skip();
            }
        });

       afterEach(async function () {
            await VSBrowser.instance.driver.wait(
                async () => true,
                1000
            );
        });

        it('Start Dev works', async function () {
            this.timeout(80_000);

            await waitForItemStable(getSection, componentName, true);

            //start dev
            await startDev(true);

            // workaround for failed start dev due to undefined contextPath error
            const notificationCenter = await new Workbench().openNotificationsCenter();
            const notifications = await notificationCenter.getNotifications(NotificationType.Any);
            if (notifications.length > 0) {
                await startDev(true);
            }
            await notificationCenter.close();

            // wait for terminal tab checking the active tab's name
            openshiftTerminal = await waitForTerminalWithActiveTab(expectedTabName);

            await openshiftTerminal.getTerminalText();

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

            await stabilizeComponentsView(getSection);

            // When the component is Dev-running its label has changed, so we'll check that:
            // - ...component with the original name doesn't exist
            await waitForItemToDisappear(getSection, componentName);  // Throws if exists

            // - ...component with modifed name (like " (dev running)" added) exists
            await waitForItem(getSection, componentName, false); // Throws if NOT exists

            // ... if we got to this point then we assume the component exists and is running

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

            await stabilizeComponentsView(getSection);

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

        it('Start/Stop Dev on Podman works', async function () {
            this.timeout(80_000);

            await stabilizeComponentsView(getSection);

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

        it('Describe component works', async function () {
            this.timeout(80_000);

            await stabilizeComponentsView(getSection);

            //start dev
            await startDev(true);

            //wait for start dev to finish
            await waitForStartDevToFinish(true);

            // get the updated component item
            const component = await waitForItemStable(getSection, componentName, false);

            //describe component
            const contextMenu = await component.openContextMenu();
            await contextMenu.select(MENUS.describe);

            //check tab name
            const tabName = await openshiftTerminal.getActiveTabName();
            expect(tabName).to.contain(`Describe '${componentName}' Component`);

            //Check for terminal content
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

        it('Show dev terminal works', async function () {
            this.timeout(80_000);
            const component = await waitForItemStable(getSection, componentName, false);

            //open menu and select show dev terminal
            const contextMenu = await component.openContextMenu();
            await contextMenu.select(MENUS.showDevTerminal);

            //check for active tab
            const tabName = await openshiftTerminal.getActiveTabName();
            expect(tabName).to.contain(expectedTabName);
        });

        it('Debug works', async function () {
            this.timeout(80_000);

            const component = await waitForItemStable(getSection, componentName, false);

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
            const debugConsole = await bottomBar.openDebugConsoleView();

            //wait for console to have text
            const bottomBarText = await bottomBar.getDriver().wait(
                async () => {
                    const text = await debugConsole.getText();

                    if (text && text.includes('App started on PORT')) {
                        return text;
                    }

                    return null;
                },
                20_000,
                'Debug console did not contain expected output'
            );

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
            await new Promise((res) => {
                setTimeout(res, 500);
            });
            await debugSession.expand();

            //click on item
            const item = await debugSession.findItem(componentName);
            await item.click();

            //get call stack section view
            const debugView = new DebugView();
            const callStackSection = await debugView.getCallStackSection();

            //check item exists and end debugging by clicking on disconnect

            const debugItem = await callStackSection.getDriver().wait(
                async () => {
                    try {
                        const item = await callStackSection.findItem(async (el) => {
                            const label = await el.getLabel();
                            return label.includes(`Attach to '${componentName}' component`);
                        });
                        if (item) {
                            return item;
                        }
                    } catch {
                        return null;
                    }
                },
                10_000,
                `Item with label '${`Attach to '${componentName}' component`}' was not found`,
            );
            const disconnectButton = await debugItem.getActionButton('Disconnect (Shift+F5)');
            await disconnectButton.click();

            //open openshift view again and get debug sessions view
            openshiftView = await openshiftControl.openView();
            debugSession = await openshiftView.getContent().getSection(VIEWS.debugSessions);

            //check view is empty
            await itemDoesNotExist(componentName, debugSession);
        });

        async function getSection(): Promise<ViewSection> {
            return await view.getContent().getSection(VIEWS.components);
        }

        async function startDev(devOnCluster: boolean): Promise<void> {
            const option = devOnCluster ? MENUS.startDev : MENUS.startDevPodman;

            await VSBrowser.instance.driver.wait(async () => {
                try {
                    const section = await getSection();
                    const component = await section.findItem(componentName);
                    if (!component) return false;

                    const menu = await component.openContextMenu();
                    const items = await menu.getItems();

                    for (const item of items) {
                        const itemLabel = await item.getLabel();
                        if (itemLabel === option) {
                            try {
                                await item.safeClick();
                                return true;
                            } catch(err) {
                                // close menu before retry
                                await VSBrowser.instance.driver.actions().sendKeys('\uE00C').perform(); // ESC
                                throw err;
                            }
                        }
                    }

                    // close menu before retry
                    await VSBrowser.instance.driver.actions().sendKeys('\uE00C').perform(); // ESC
                    return false;

                } catch {
                    return false;
                }
            }, 20000, `Context menu item "${option}" not available`);
        }

        async function waitForStartDevToFinish(devOnCluster: boolean): Promise<void> {
            const podmanString = devOnCluster ? '' : ' on podman';
            await waitForItemStable(getSection, `${componentName} (dev starting${podmanString})`);
            await waitForItemStable(getSection, `${componentName} (dev running${podmanString})`, true, 40_000);
        }

        async function stopDev(): Promise<void> {
            await VSBrowser.instance.driver.wait(async () => {
                try {
                    const section = await getSection();
                    const component = await findItemFuzzy(section, componentName);
                    if (!component) return false;

                    const menu = await component.openContextMenu();
                    const items = await menu.getItems();

                    for (const item of items) {
                        if ((await item.getLabel()) === MENUS.stopDev) {
                            try {
                                await item.safeClick();
                                return true;
                            } catch(err) {
                                // close menu before retry
                                await VSBrowser.instance.driver.actions().sendKeys('\uE00C').perform(); // ESC
                                throw err;
                            }
                        }
                    }

                    // close menu before retry
                    await VSBrowser.instance.driver.actions().sendKeys('\uE00C').perform(); // ESC
                    return false;

                } catch {
                    return false;
                }
            }, 20000, `Context menu item "${MENUS.stopDev}" not available`);
        }

        async function waitForStopDevToFinish(devOnCluster: boolean): Promise<void> {
            if (devOnCluster) {
                await waitForItemStable(getSection, `${componentName} (dev stopping)`);
            }
            await waitForItemStable(getSection, componentName, true, 60_000);
        }

        async function waitForTerminalWithActiveTab(expectedTabName: string, timeout = 20000): Promise<OpenshiftTerminalWebviewView> {
            let terminal: OpenshiftTerminalWebviewView | undefined;
            await VSBrowser.instance.driver.wait(async () => {
                try {
                    terminal = new OpenshiftTerminalWebviewView();
                    const tabName = await terminal.getActiveTabName();
                    if (!tabName || !tabName.includes(expectedTabName)) {
                        return false;
                    }

                    const text = await terminal.getTerminalText();
                    return text !== undefined;
                } catch {
                    return false;
                }
            }, timeout, `Terminal tab "${expectedTabName}" did not open`);

            return terminal!;
        }
    });
}
