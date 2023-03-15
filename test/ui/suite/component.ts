/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { ActivityBar, EditorView, InputBox, SideBarView, TerminalView, TreeItem, ViewSection, VSBrowser, WelcomeContentButton, Workbench } from 'vscode-extension-tester';
import { itemExists, notificationExists, terminalHasText, waitForInputUpdate } from '../common/conditions';
import { BUTTONS, COMPONENTS, INPUTS, MENUS, NOTIFICATIONS, VIEWS } from '../common/constants';

export function createComponentTest(contextFolder: string) {
    describe('Component creation', function() {
        const cluster = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
        const clusterName = cluster;
        const user = process.env.CLUSTER_USER || 'developer';
        const password = process.env.CLUSTER_PASSWORD || 'developer';
        let view: SideBarView;
        let explorer: ViewSection;
        let components: ViewSection;
        let editorView: EditorView;

        const projectName = `project${Math.floor(Math.random() * 100)}`
        const compName = `comp${Math.floor(Math.random() * 100)}`;

        before(async function () {
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            explorer = await view.getContent().getSection(VIEWS.appExplorer);
            components = await view.getContent().getSection(VIEWS.components);
            editorView = new EditorView();
        });

        beforeEach(async function() {
            const center = await new Workbench().openNotificationsCenter();
            await center.clearAllNotifications();
        });

        afterEach(async function() {
            editorView = new EditorView();
            await editorView.closeAllEditors();
        });

        after(async function() {
            this.timeout(60000);
            const projectItem = await explorer.findItem(projectName);
            if (projectItem) {
                const menu = await projectItem.openContextMenu();
                await menu.select(MENUS.delete);
                const notif = await notificationExists(NOTIFICATIONS.deleteProjectWarning(projectName), VSBrowser.instance.driver);
                await notif.takeAction(INPUTS.yes);
                await notificationExists(NOTIFICATIONS.projectDeleteSuccess(projectName), VSBrowser.instance.driver, 40000);
            }
        });

        it('Login with credentials', async function() {
            this.timeout(30_000);
            await explorer.expand();
            const content = await explorer.findWelcomeContent();
            // eslint-disable-next-line no-console, @typescript-eslint/restrict-template-expressions
            console.log(`content: ${await Promise.all((await content.getButtons()).map(async item => await item.getTitle()))}`);
            const btns = await content.getButtons();
            let loginBtn: WelcomeContentButton;

            for(const btn of btns) {
                if (await btn.getTitle() === BUTTONS.login) {
                    loginBtn = btn;
                    break;
                }
            }
            if (!loginBtn) {
                expect.fail('No login button available');
            }
            await loginBtn.click();
            // select new URL
            const inputBox = await InputBox.create();
            await inputBox.selectQuickPick(INPUTS.newUrlQuickPick);

            // provide the cluster URL
            const clusterMessage = await waitForInputUpdate(inputBox, '');
            await inputBox.setText(cluster);
            await inputBox.confirm();

            // select credentials login
            const typeMessage = await waitForInputUpdate(inputBox, clusterMessage);
            await inputBox.selectQuickPick(INPUTS.credentialsQuickPick);

            // create new credentials
            const userMessage = await waitForInputUpdate(inputBox, typeMessage);
            await inputBox.selectQuickPick(INPUTS.newUserQuickPick);

            // provide user name
            const nameMessage = await waitForInputUpdate(inputBox, userMessage);
            await inputBox.setText(user);
            await inputBox.confirm();

            // provide password
            await waitForInputUpdate(inputBox, nameMessage);
            await inputBox.setText(password);
            await inputBox.confirm();

            // don't save the credentials when asked
            const notification = await notificationExists(NOTIFICATIONS.savePasswordPrompt, VSBrowser.instance.driver);
            await notification.takeAction(INPUTS.no);

            // wait for confirmation that the login was successful
            await notificationExists(NOTIFICATIONS.loginSuccess(cluster), VSBrowser.instance.driver, 15000);

            // make sure the cluster shows up in the tree view
            const clusterItem = await itemExists(clusterName, explorer);
            expect(clusterItem).not.undefined;
        });

        it('Create a new project', async function() {
            this.timeout(30000);
            const clusterItem = await explorer.findItem(clusterName) as TreeItem;
            const menu = await clusterItem.openContextMenu();
            await menu.select(MENUS.newProject);

            const input = await InputBox.create();
            await input.setText(projectName);
            await input.confirm();

            await clusterItem.expand();
            await itemExists(projectName, explorer);
        });

        it('Create a new component from scratch', async function() {
            this.timeout(120_000);
            const newComponent = (await (await components.findWelcomeContent()).getButtons())[1];
            await newComponent.click();

            // wait for input quick pick to appear
            const input = await InputBox.create();

            // select to add new context folder
            await input.selectQuickPick(INPUTS.newFolderQuickPick);

            // select the context folder
            await input.setText(contextFolder);
            await input.confirm();

            // select nodejs devfile template
            await new Promise(res => setTimeout(res, 500));
            await input.setText(COMPONENTS.nodejsDevfile);
            await input.confirm();

            // select yes for starter project
            await new Promise(res => setTimeout(res, 500));
            await input.selectQuickPick(INPUTS.yes);

            // provide component name
            await new Promise(res => setTimeout(res, 500));
            await input.setText(compName);
            await input.confirm();

            await new Promise(res => setTimeout(res, 5000));
            const project = await itemExists(projectName, explorer) as TreeItem;
            await project.expand();

            await itemExists(compName, components, 30_000);
        });

        it('Start the component in dev mode', async function() {
            this.timeout(180000);
            const component = await itemExists(compName, components, 30_000);

            const menu = await component.openContextMenu();
            await menu.select(MENUS.startDev);
            await terminalHasText(COMPONENTS.devStarted, 60_000);

            const term = new TerminalView();
            await term.killTerminal();

            // wait for component to stop running.
            // the component name changes to
            // `component-name (stopping)`
            // while `odo dev` is stopping
            // then it returns to
            // `component-name`
            // when `odo dev` has stopped
            await itemExists(compName, components, 60_000);
        });

        it('Check for \'Bind Service\' button (don\'t click it)', async function() {
            this.timeout(60000);
            const component = await itemExists(compName, components);
            const menu = await component.openContextMenu();
            expect(await menu.hasItem(MENUS.bindService)).to.be.true;
        });

    });
}
