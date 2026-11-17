/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    ActivityBar,
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
import {
    itemExists,
    notificationExists,
    openContextMenuAndSelect,
    resetNotificationState,
    stabilizeComponentsView,
    waitForItem,
    waitForItemStable,
    warn
} from '../common/conditions';
import { INPUTS, MENUS, NOTIFICATIONS, VIEWS } from '../common/constants';
import { closeAllOpenEditors } from '../common/overdrives';

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
            await resetNotificationState();

            await stabilizeComponentsView(getExplorer);

            const explorer = await getExplorer();
            await explorer.expand(3_000);

            await itemExists(clusterName, explorer);
        });

        beforeEach(async function () {
            await closeAllOpenEditors();
            // Leftover notifications from earlier tests interfere with this
            // suite in two ways: a sticky toast can cover the status-bar bell
            // (breaking notificationExists()'s access to the Notifications
            // Center) or the explorer tree rows (swallowing right-clicks, so
            // no context menu ever opens). Start every test from a clean
            // notification slate.
            await resetNotificationState();
        });

        //Switch back to existing project/namespace
        after(async function () {
            this.timeout(30_000);
            try {
                const notifications = await new Workbench().getNotifications();
                for (const n of notifications) {
                    try { await n.dismiss(); } catch { /* Ignore */ }
                }
            } catch { /* Ignore */ }
            try {
                // "Delete a project" calls notificationExists() (common/conditions.ts), which
                // opens the Notifications Center to poll for a message but never closes it -
                // a left-open center can interfere with activateCommand()'s command palette
                // rendering right below.
                await (await new Workbench().openNotificationsCenter()).close();
            } catch { /* Ignore */ }
            await closeAllOpenEditors();

            const option = isOpenshiftCluster ? 'Set Active Project' : 'Set Active Namespace';
            const command = `>OpenShift: ${option}`;

            // This only exists to leave a valid active project/namespace in place for later,
            // unrelated suites (Kubernetes Context, Operator-Backed Service) to run against -
            // its failure doesn't mean anything in "Work with project" itself is broken, so it
            // must not fail this suite's teardown. The previous test just deleted the
            // currently-active project, so the extension may still be mid-transition when this
            // runs - retry the whole thing rather than trust a single attempt.
            try {
                await VSBrowser.instance.driver.wait(async () => {
                    try {
                        await activateCommand(command);
                        const input = await InputBox.create();
                        await input.setText(anotherProjectName);
                        await input.confirm();
                        return true;
                    } catch {
                        return false;
                    }
                }, 20_000);

                const explorer = await getExplorer();
                await itemExists(anotherProjectName, explorer);
            } catch {
                warn(`Could not switch back to project "${anotherProjectName}" - later suites are responsible for their own setup`);
            }
        });

        it('Create a new project', async function () {
            this.timeout(30_000);

            const clusterItem = await waitForItem(getExplorer, clusterName) as TreeItem;
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

            const clusterItem = await waitForItem(getExplorer, clusterName) as TreeItem;
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
            this.timeout(120_000);

            // Self-contained setup: create a dedicated project to delete
            // instead of reusing one built by the previous tests, so this test
            // depends on nothing but the cluster. Creating a project also
            // makes it the active one, and the explorer tree only ever shows
            // the active project under the cluster node - which is exactly
            // the user flow this test exercises.
            const name = getProjectName('project-del-');

            const clusterItem = await waitForItem(getExplorer, clusterName) as TreeItem;
            await clusterItem.expand();

            await openContextMenuAndSelect(getExplorer, clusterName, newProject);

            await new Promise((res) => {
                setTimeout(res, 500);
            });

            const input = await InputBox.create();
            await input.setText(name);
            await input.confirm();

            // The item showing up proves both that the project was created
            // and that it became the active one.
            await waitForItemStable(getExplorer, name);

            // Re-expand the cluster node - the refresh triggered by the
            // project creation may have collapsed it.
            const clusterNode = await waitForItem(getExplorer, clusterName) as TreeItem;
            await clusterNode.expand();

            await openContextMenuAndSelect(getExplorer, name, deleteProject);

            // Match the warning by prefix: when the project is not empty the
            // extension appends " and all its contents" before the final
            // question mark.
            const warning = isOpenshiftCluster
                ? `Do you want to delete Project '${name}'`
                : `Do you want to delete Namespace '${name}'`;

            // The extension runs an oc call before showing the confirmation,
            // so give the notification a generous timeout.
            const notif = await notificationExists(warning, VSBrowser.instance.driver, 30_000);
            await notif.takeAction(INPUTS.yes);

            const success = isOpenshiftCluster
                ? NOTIFICATIONS.projectDeleteSuccess(name)
                : NOTIFICATIONS.namespaceDeleteSuccess(name);
            await notificationExists(success, VSBrowser.instance.driver, 30_000);

            // No tree-level assertion here on purpose: deleting the *active*
            // project leaves the kubeconfig context pointing at the deleted
            // namespace, and the explorer keeps showing it (with a
            // Create/set-active affordance) until the context is switched to
            // another project - which this suite's after() hook does. The
            // "successfully deleted" notification above is the authoritative
            // proof that the cluster-level deletion completed.
        });

        function getProjectName(prefix = 'project') {
            // Date.now() keeps the name unique across runs on the same
            // cluster - a short random suffix can collide with a namespace
            // left over by a previous (failed) run.
            return `${prefix}${Date.now()}`;
        }

        async function getExplorer(): Promise<ViewSection> {
            return await view.getContent().getSection(VIEWS.appExplorer);
        }
    });
}
