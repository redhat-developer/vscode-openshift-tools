/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    ActivityBar,
    EditorView,
    InputBox,
    SideBarView,
    TreeItem,
    VSBrowser,
    ViewSection,
    Workbench,
    after,
    before,
    beforeEach
} from 'vscode-extension-tester';
import { activateCommand } from '../common/command-activator';
import { itemExists, notificationExists } from '../common/conditions';
import { INPUTS, MENUS, NOTIFICATIONS, VIEWS } from '../common/constants';

export function projectTest(isOpenshiftCluster: boolean) {
    describe('Work with project', function () {
        const cluster = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
        const clusterName = cluster;

        const newProject = isOpenshiftCluster ? MENUS.newProject : MENUS.newNamespace;
        const changeProject = isOpenshiftCluster
            ? 'Change Active Project'
            : 'Change Active Namespace';
        const deleteProject = isOpenshiftCluster ? MENUS.deleteProject : MENUS.deleteNamespace;

        let view: SideBarView;

        let projectName: string;
        let anotherProjectName: string;

        before(async function () {
            this.timeout(10_000);
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            // await (await new Workbench().openNotificationsCenter()).clearAllNotifications();
            try {
                const notifications = await new Workbench().getNotifications();
                for (const n of notifications) {
                    try { await n.dismiss(); } catch { /* Ignore */ }
                }
            } catch { /* Ignore */ }
            const explorer = await getExplorer();
            await explorer.expand();
            await itemExists(clusterName, explorer);
        });

        beforeEach(async function () {
            // try {
            //     const notificationCenter = await new Workbench().openNotificationsCenter();
            //     await notificationCenter.clearAllNotifications();
            // } catch { /* ignore */ }

            await new EditorView().closeAllEditors();
        });

        afterEach(async function () {
            // try {
            //     const center = await new Workbench().openNotificationsCenter();
            //     await center.close();
            // } catch { /* ignore */ }
        });

        //Switch back to existing project/namespace
        after(async () => {
            const option = isOpenshiftCluster ? 'Set Active Project' : 'Set Active Namespace';
            const command = `>OpenShift: ${option}`;
            await activateCommand(command);

            const input = await InputBox.create();
            await input.setText(anotherProjectName);
            await input.confirm();

            const explorer = await getExplorer();
            (await itemExists(anotherProjectName, explorer)) as TreeItem;
        });

        it('Create a new project', async function () {
            this.timeout(30_000);
            const clusterItem = (await (await getExplorer()).findItem(clusterName)) as TreeItem;
            await clusterItem.expand();
            const contextMenu = await clusterItem.openContextMenu();
            await contextMenu.select(newProject);

            await new Promise((res) => {
                setTimeout(res, 500);
            });

            projectName = getProjectName();
            const input = await InputBox.create();
            await input.setText(projectName);
            await input.confirm();

            const explorer = await getExplorer();
            await itemExists(projectName, explorer);
        });

        it('Project can be changed', async function () {
            this.timeout(30_000);
            anotherProjectName = getProjectName();

            const clusterItem = (await (await getExplorer()).findItem(clusterName)) as TreeItem;
            await clusterItem.expand();
            const contextMenu = await clusterItem.openContextMenu();
            await contextMenu.select(newProject);

            let input = await InputBox.create();
            await input.setText(anotherProjectName);
            await input.confirm();

            let explorer = await getExplorer();
            const item = (await itemExists(anotherProjectName, explorer)) as TreeItem;

            const changeActiveProjectButton = await item.getActionButton(changeProject);
            await changeActiveProjectButton.click();

            input = await InputBox.create();
            await new Promise((res) => {
                setTimeout(res, 1_000);
            });
            await input.setText(projectName);
            await input.confirm();

            explorer = await getExplorer();
            await itemExists(projectName, explorer);
        });

        it('Delete a project', async function () {
            this.timeout(30_000);

            const projectItem = await (await getExplorer()).findItem(projectName);
            const contextMenu = await projectItem.openContextMenu();

            await contextMenu.select(deleteProject);

            // await contextMenu.select(deleteProject);

            let notif;

            if (isOpenshiftCluster) {
                notif = await notificationExists(
                    NOTIFICATIONS.deleteProjectWarning(projectName),
                    VSBrowser.instance.driver,
                );
            } else {
                notif = await notificationExists(
                    NOTIFICATIONS.deleteNamespaceWarning(projectName),
                    VSBrowser.instance.driver,
                );
            }

            await notif.takeAction(INPUTS.yes);

            if (isOpenshiftCluster) {
                await notificationExists(
                    NOTIFICATIONS.projectDeleteSuccess(projectName),
                    VSBrowser.instance.driver,
                );
            } else {
                await notificationExists(
                    NOTIFICATIONS.namespaceDeleteSuccess(projectName),
                    VSBrowser.instance.driver,
                );
            }
        });

        function getProjectName() {
            return `project${Math.floor(Math.random() * 100)}`;
        }

        async function getExplorer(): Promise<ViewSection> {
            return await view.getContent().getSection(VIEWS.appExplorer);
        }
    });
}
