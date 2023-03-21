/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { ActivityBar, InputBox, SideBarView, TreeItem, ViewSection, VSBrowser, WelcomeContentButton, Workbench } from 'vscode-extension-tester';
import { itemExists, notificationExists, terminalHasText, waitForInputProgress, waitForInputUpdate } from '../common/conditions';
import { BUTTONS, COMPONENTS, INPUTS, MENUS, NOTIFICATIONS, VIEWS } from '../common/constants';

export function createComponentTest(contextFolder: string) {
    describe('Component creation', () => {
        const cluster = process.env.CLUSTER_URL || 'https://api.ocp2.adapters-crs.ccitredhat.com:6443';
        const clusterName = (/https?:\/\/(.*)/.exec(cluster))[1];
        const user = process.env.CLUSTER_USER || 'developer';
        const password = process.env.CLUSTER_PASSWORD || 'developer';
        let view: SideBarView;
        let explorer: ViewSection;
        let components: ViewSection;

        const projectName = `project${Math.floor(Math.random() * 100)}`
        const appName = `app${Math.floor(Math.random() * 100)}`;
        const compName = `comp${Math.floor(Math.random() * 100)}`;

        before(async () => {
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            explorer = await view.getContent().getSection(VIEWS.appExplorer);
            components = await view.getContent().getSection(VIEWS.components);
        });

        beforeEach(async () => {
            const center = await new Workbench().openNotificationsCenter();
            await center.clearAllNotifications();
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
            this.timeout(30000);
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
            this.timeout(60000);
            const newComponent = (await (await components.findWelcomeContent()).getButtons())[0];
            await newComponent.click();

            // provide application name
            const input = await InputBox.create();
            const appMessage = await input.getMessage();
            await input.setText(appName);
            await input.confirm();

            // select to add new context folder
            await waitForInputUpdate(input, appMessage);
            await input.selectQuickPick(INPUTS.newFolderQuickPick);

            // select the context folder
            await input.setText(contextFolder);
            await input.confirm();

            // provide component name
            await waitForInputUpdate(input, '');
            await input.setText(compName);
            await input.confirm();

            // select nodejs devfile template
            await waitForInputProgress(input, true);
            await waitForInputProgress(input, false, 20000);
            await new Promise(res => setTimeout(res, 500));
            await input.setText(COMPONENTS.nodejsDevfile);
            await input.confirm();

            // select yes for starter project
            await new Promise(res => setTimeout(res, 500));
            await input.selectQuickPick(INPUTS.yes);
            await new Promise(res => setTimeout(res, 5000));
            const project = await itemExists(projectName, explorer) as TreeItem;
            await project.expand();

            const app = await itemExists(appName, explorer) as TreeItem;
            await app.expand();
            await itemExists(COMPONENTS.devfileComponent(compName), explorer);
        });

        it('Push the component', async function() {
            this.timeout(150000);
            const component = await itemExists(COMPONENTS.devfileComponent(compName), explorer);
            const menu = await component.openContextMenu();
            await menu.select(MENUS.push);
            await terminalHasText(COMPONENTS.pushSuccess, 120000);
        });

        it('Create a component from components view', async function () {
            this.timeout(15_000);
            const actionButton = await components.getAction('New Component');
            await actionButton.click();

            // provide component folder
            const input = await InputBox.create();
            const componentMessage = await input.getMessage();
            await input.setText(contextFolder);
            await input.confirm();
            await waitForInputUpdate(input, componentMessage);

            // select the go devfile
            const devfileMessage = await input.getMessage();
            await input.setText('go/DefaultDevfileRegistry');
            await input.confirm();
            await waitForInputUpdate(input, devfileMessage);

            // say YES to starter code
            await new Promise(res => setTimeout(res, 500));
            await input.selectQuickPick(INPUTS.yes);

            // provide component name
            await waitForInputUpdate(input, '');
            await input.setText(compName);
            await input.confirm();

            await new Promise(res => setTimeout(res, 5000));
            const project = await itemExists(projectName, explorer) as TreeItem;
            await project.expand();
        });
    });
}
