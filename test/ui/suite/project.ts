/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { SideBarView, ViewSection, EditorView, InputBox, ActivityBar, NotificationType, Workbench, TreeItem, VSBrowser } from 'vscode-extension-tester';
import { itemExists, notificationExists } from '../common/conditions';
import { INPUTS, MENUS, NOTIFICATIONS, VIEWS } from '../common/constants';
//import { expect } from 'chai';

export function projectTest(isOpenshiftCluster: boolean) {
    describe('Work with project', function () {

        const cluster = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
        const clusterName = cluster;

        const newProject = isOpenshiftCluster ? MENUS.newProject : MENUS.newNamespace;
        const changeProject = isOpenshiftCluster ? 'Change Active Project' : 'Change Active Namespace';
        const deleteProject = isOpenshiftCluster ? MENUS.deleteProject : MENUS.deleteNamespace;

        let view: SideBarView;
        let explorer: ViewSection;

        let projectName: string;
        let anotherProjectName: string;

        before(async function () {
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            explorer = await view.getContent().getSection(VIEWS.appExplorer);
            await explorer.expand();
            const actions = await explorer.getActions();
            await actions[3].click();
            await itemExists(clusterName, explorer);
        });

        beforeEach(async function () {
            const notificationCenter = await new Workbench().openNotificationsCenter();
            const notifications = await notificationCenter.getNotifications(NotificationType.Any);
            if (notifications.length > 0) {
                await notificationCenter.close();
            }
            await new EditorView().closeAllEditors();
        });

        it('Create a new project', async function () {
            this.timeout(30_000);
            const clusterItem = await explorer.findItem(clusterName) as TreeItem;
            await clusterItem.expand();
            const contextMenu = await clusterItem.openContextMenu();
            await contextMenu.select(newProject);

            await new Promise((res) => { setTimeout(res, 500) });

            projectName = getProjectName();
            const input = await InputBox.create();
            await input.setText(projectName);
            await input.confirm();

            await itemExists(projectName, explorer);
        });

        it('Project can be changed', async function () {
            this.timeout(30_000);
            anotherProjectName = getProjectName();

            const clusterItem = await explorer.findItem(clusterName) as TreeItem;
            await clusterItem.expand();
            const contextMenu = await clusterItem.openContextMenu();
            await contextMenu.select(newProject);

            let input = await InputBox.create();
            await input.setText(anotherProjectName);
            await input.confirm();

            const item = await itemExists(anotherProjectName, explorer) as TreeItem;

            const changeActiveProjectButton = await item.getActionButton(changeProject);
            await changeActiveProjectButton.click();

            input = await InputBox.create();
            await new Promise((res) => {setTimeout(res, 1_000)});
            await input.setText(projectName);
            await input.confirm();

            await itemExists(projectName, explorer);
        });

        it('Delete a project', async function () {
            this.timeout(30_000);
            const projectItem = await explorer.findItem(projectName);
            const contextMenu = await projectItem.openContextMenu();

            await contextMenu.select(deleteProject);

            let notif;

            if (isOpenshiftCluster) {
                notif = await notificationExists(NOTIFICATIONS.deleteProjectWarning(projectName), VSBrowser.instance.driver)
            } else {
                notif = await notificationExists(NOTIFICATIONS.deleteNamespaceWarning(projectName), VSBrowser.instance.driver);
            }

            await notif.takeAction(INPUTS.yes);

            if (isOpenshiftCluster) {
                await notificationExists(NOTIFICATIONS.projectDeleteSuccess(projectName), VSBrowser.instance.driver);
            } else {
                await notificationExists(NOTIFICATIONS.namespaceDeleteSuccess(projectName), VSBrowser.instance.driver);
            }
        });


        function getProjectName() {
            return `project${Math.floor(Math.random() * 100)}`
        }
    })
}