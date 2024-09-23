/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    ActivityBar,
    EditorView,
    SideBarView,
    TreeItem,
    ViewSection,
} from 'vscode-extension-tester';
import { VIEWS } from '../common/constants';
import { expect } from 'chai';
import { OpenshiftTerminalWebviewView } from '../common/ui/webviewView/openshiftTerminalWebviewView';
import * as yml from 'js-yaml';
import * as fs from 'fs';
import * as pth from 'path';
import { reloadWindow } from '../common/overdrives';
import { itemExists } from '../common/conditions';

export function testComponentCommands(path: string) {
    describe('Component Commands', function () {
        let view: SideBarView;
        let section: ViewSection;
        let commands: TreeItem[];

        const componentName = 'nodejs-starter';

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

            //expect component is running
            section = await view.getContent().getSection(VIEWS.components);
            const item = await itemExists(`${componentName} (dev running)`, section);
            expect(item).is.not.undefined;
        });

        after(async function () {
            //close openshift terminal
            await reloadWindow();
        });

        it('Commands are listed', async function () {
            //get expected commands
            const devfile = fs.readFileSync(pth.join(path, componentName, 'devfile.yaml'), 'utf-8');
            const parsedDevfile = yml.load(devfile) as { [key: string]: any };
            const expectedCommands = [];

            parsedDevfile.commands.forEach((command) => {expectedCommands.push(command.id)});

            //get component
            const components = await section.getVisibleItems();
            const component = components[0] as TreeItem;
            await component.expand();

            //check component has child with label Commands
            expect(await component.hasChildren()).to.be.true;
            const commandsItem = await component.findChildItem('Commands');

            //check Commands has children
            commands = await commandsItem.getChildren();
            const actualCommands = []
            for (const command of commands) {
                actualCommands.push(await command.getLabel());
            }
            expect(actualCommands).to.include.members(expectedCommands);
        });

        it('Command can be ran', async function () {
            //get first command's label and select it
            const commandName = await commands[0].getLabel();
            await commands[0].select();

            //Check for action button and click it
            const actionButton = await commands[0].getActionButton('Run Command');
            await actionButton.click();

            //check for openshift terminal tab name
            const terminal = new OpenshiftTerminalWebviewView();
            const terminalTabName = await terminal.getActiveTabName();
            expect(terminalTabName).to.contain(
                `Component ${componentName}: Run '${commandName}' Command`,
            );

            //check command run to then end
            const terminalText = await terminal.getTerminalText();
            expect(terminalText).to.contain('Press any key to close this terminal');
        });
    });
}
