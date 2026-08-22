/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import * as fs from 'fs';
import * as pth from 'path';
import {
    ActivityBar,
    after,
    before,
    SideBarView,
    TreeItem,
    ViewSection,
    VSBrowser,
    Workbench,
} from 'vscode-extension-tester';
import { parse } from 'yaml';
import { DevfileResolver } from '../../../src/devfile/devfileResolver';
import { stabilizeComponentsView, waitForItemStable, warn } from '../common/conditions';
import { VIEWS } from '../common/constants';
import { closeAllOpenEditors, collapseViews, reloadWindow } from '../common/overdrives';
import { OpenshiftTerminalWebviewView } from '../common/ui/webviewView/openshiftTerminalWebviewView';

export function testComponentCommands(path: string) {
    describe('Component Commands', function () {
        this.timeout(30_000);

        let view: SideBarView;
        let commands: TreeItem[];

        const componentName = 'nodejs-starter';

        before(async function context() {
            this.timeout(65_000);
            await closeAllOpenEditors();
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            await (await new Workbench().openNotificationsCenter()).clearAllNotifications();

            await collapseViews(view, [
                VIEWS.appExplorer,
                VIEWS.compRegistries,
                VIEWS.serverlessFunctions,
                VIEWS.debugSessions,
            ]);

            // expect component is running
            try {
                const componentInDevName = `${componentName} (dev running)`;
                const item = await waitForItemStable(getSection, componentInDevName, true, 40_000);
                if (!item) {
                    warn(`Component "${componentName}" not found or isn't running in Dev, skipping tests`);
                    this.skip();
                }
            } catch (err) {
                warn('Error in before hook: "Component Commands":', err);
                this.skip();
            }
        });

        after(async function () {
            //close openshift terminal
            await reloadWindow();
        });

        it('Commands are listed', async function () {

            // Get expected commands
            const devfile = fs.readFileSync(pth.join(path, componentName, 'devfile.yaml'), 'utf-8');
            const parsedDevfile = parse(devfile) as { [key: string]: any };

            const resolver = new DevfileResolver();
            const resolvedDevfile = await resolver.resolve(parsedDevfile);

            const expectedCommands = [];

            resolvedDevfile.commands.forEach((command) => {
                expectedCommands.push(command.id);
            });

            // First, collapse the component to clear any stale cached state from previous tests
            // (e.g., from componentContextMenu.ts which runs before this suite)
            await VSBrowser.instance.driver.wait(async () => {
                try {
                    const section = await getSection();
                    const components = await section.getVisibleItems();
                    if (components?.length) {
                        const comp = components[0] as TreeItem;
                        if (await comp.isExpanded()) {
                            await comp.collapse();
                            await new Promise((res) => setTimeout(res, 300));
                            return true;
                        }
                    }
                    return false;
                } catch {
                    return false;
                }
            }, 5_000);

            // Expand the component again to get fresh tree data
            await VSBrowser.instance.driver.wait(async () => {
                try {
                    const section = await getSection();
                    const components = await section.getVisibleItems();
                    if (components?.length) {
                        const comp = components[0] as TreeItem;
                        if (!(await comp.isExpanded())) {
                            await comp.expand();
                            await stabilizeComponentsView(getSection, 5_000);
                            return true;
                        }
                    }
                    return false;
                } catch {
                    return false;
                }
            }, 10_000);

            // Now get the Commands tree item and wait for children to populate
            // Expanding the item alone doesn't guarantee all child rows have rendered yet,
            // so poll until at least as many as the devfile declares actually show up.
            await VSBrowser.instance.driver.wait(async () => {
                try {
                    const section = await getSection();
                    if (!section) return false;

                    const components = await section.getVisibleItems();
                    if (!components?.length) return false;

                    const freshComponent = components[0] as TreeItem;
                    const commandsItem = await freshComponent.findChildItem('Commands');
                    if (!commandsItem) return false;

                    await commandsItem.expand();
                    // Wait a brief moment for the tree to render children after expand
                    await new Promise((res) => setTimeout(res, 500));
                    commands = await commandsItem.getChildren();
                    return commands.length >= expectedCommands.length;
                } catch {
                    return false;
                }
            }, 20_000, 'Commands node children did not populate');

            const actualCommands = [];
            for (const command of commands) {
                actualCommands.push(await command.getLabel());
            }
            expect(actualCommands).to.include.members(expectedCommands);

            // The sets of devfile component commands (expectedCommands) and actual component commands (actualCommands)
            // are to be the same
            expect(actualCommands).to.have.members(expectedCommands);
        });

        it('Command can be ran', async function () {

            // get first command's label and select it
            const commandName = await commands[0].getLabel();
            await commands[0].select();

            // Check for action button and click it
            const actionButton = await commands[0].getActionButton('Run Command');
            expect(actionButton).to.not.be.undefined;

            await actionButton.click();

            const terminal = new OpenshiftTerminalWebviewView();

            // Wait for the terminal created by Run Command
            await new Promise((resolve) => setTimeout(resolve, 5000));

            const terminalTabName = await terminal.getActiveTabName();

            expect(terminalTabName).to.contain(
                `Component ${componentName}: Run '${commandName}' Command`,
            );

            // Wait for command execution to complete
            await new Promise((resolve) => setTimeout(resolve, 5000));

            const terminalText = await terminal.getTerminalText();

            expect(terminalText).to.contain('Press any key to close this terminal');
        });

        async function getSection(): Promise<ViewSection> {
            return await view.getContent().getSection(VIEWS.components);
        }
    });
}
