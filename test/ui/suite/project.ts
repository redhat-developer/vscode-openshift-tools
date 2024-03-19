/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { SideBarView, ViewSection, EditorView, InputBox, ActivityBar, NotificationType, Workbench, TreeItem, VSBrowser } from 'vscode-extension-tester';
import { itemExists, itemHasText, notificationExists } from '../common/conditions';
import { INPUTS, NOTIFICATIONS, VIEWS } from '../common/constants';
import { activateCommand } from '../common/command-activator';
//import { expect } from 'chai';

export function projectTest() {
    describe('Work with project', function () {

        const cluster = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
        const clusterName = cluster;

        let view: SideBarView;
        let explorer: ViewSection;

        let projectName: string;
        let anotherProjectName: string;

        before(async function () {
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            explorer = await view.getContent().getSection(VIEWS.appExplorer);
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
            await explorer.expand();
            const clusterItem = await explorer.findItem(clusterName) as TreeItem;
            await clusterItem.expand();
            await activateCommand('>OpenShift: New Project')

            const input = await InputBox.create();
            projectName = getProjectName();
            await input.setText(projectName);
            await input.confirm();

            await itemExists(projectName, explorer);
        });

        it('Project can be changed', async function () {
            this.timeout(30_000);
            anotherProjectName = getProjectName();
            await activateCommand('>OpenShift: New Project');

            let input = await InputBox.create();
            await input.setText(anotherProjectName);
            await input.confirm();

            const item = await itemExists(anotherProjectName, explorer) as TreeItem;

            const changeActiveProjectButton = await item.getActionButton('Change Active Project');
            await changeActiveProjectButton.click();

            input = await InputBox.create();
            await new Promise((res) => {setTimeout(res, 1_000)});
            await input.setText(projectName);
            await input.confirm();

            await itemExists(projectName, explorer);
        });

        it('Delete a project', async function () {
            this.timeout(30_000);
            await activateCommand('>OpenShift: Delete Project');
            const input = await InputBox.create();
            await new Promise((res) => {setTimeout(res, 1_000)});
            await input.setText(projectName);
            await input.confirm();

            const notif = await notificationExists(NOTIFICATIONS.deleteProjectWarning(projectName), VSBrowser.instance.driver);

            await notif.takeAction(INPUTS.yes);

            await notificationExists(NOTIFICATIONS.projectDeleteSuccess(projectName), VSBrowser.instance.driver);

            await itemHasText(projectName, 'Missing Project. Create new or set active Project', explorer);
        });


        function getProjectName() {
            return `project${Math.floor(Math.random() * 100)}`
        }

    })
}