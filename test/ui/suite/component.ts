/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { ActivityBar, EditorView, InputBox, NotificationType, SideBarView, TerminalView, TreeItem, VSBrowser, ViewSection, Workbench } from 'vscode-extension-tester';
import { notificationExists, itemExists, terminalHasText } from '../common/conditions';
import { VIEWS, MENUS, NOTIFICATIONS, INPUTS, COMPONENTS } from '../common/constants';



export function createComponentTest(contextFolder: string) {
    describe('Component creation', function () {
        const cluster = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
        const clusterName = cluster;

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

        beforeEach(async function () {
            const notificationCenter = await new Workbench().openNotificationsCenter();
            const notifications = await notificationCenter.getNotifications(NotificationType.Any);
            if (notifications.length > 0) {
                await notificationCenter.close();
            }
            await new EditorView().closeAllEditors();
        });

        afterEach(async function () {
            editorView = new EditorView();
            await editorView.closeAllEditors();
        });

        after(async function () {
            this.timeout(60000);
            const projectItem = await explorer.findItem(projectName);
            if (projectItem) {
                const menu = await projectItem.openContextMenu();
                await menu.select(MENUS.deleteProject);
                const notif = await notificationExists(NOTIFICATIONS.deleteProjectWarning(projectName), VSBrowser.instance.driver);
                await notif.takeAction(INPUTS.yes);
                await notificationExists(NOTIFICATIONS.projectDeleteSuccess(projectName), VSBrowser.instance.driver, 40000);
            }
        });

        it('Create a new project', async function () {
            this.timeout(30000);
            await explorer.expand();
            const clusterItem = await explorer.findItem(clusterName) as TreeItem;
            await clusterItem.expand();
            await new Promise((res) => { setTimeout(res, 2_500); });
            const menu = await clusterItem.openContextMenu();
            await menu.select(MENUS.newProject);

            const input = await InputBox.create();
            await input.setText(projectName);
            await input.confirm();

            await itemExists(projectName, explorer);
        });

        it.skip('Create a new component from scratch', async function () {
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

        // Pending on https://github.com/redhat-developer/vscode-extension-tester/pull/855
        it.skip('Start the component in dev mode', async function () {
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

        it.skip('Check for \'Bind Service\' button (don\'t click it)', async function () {
            this.timeout(60000);
            const component = await itemExists(compName, components);
            const menu = await component.openContextMenu();
            expect(await menu.hasItem(MENUS.bindService)).to.be.true;
        });

    });
}
