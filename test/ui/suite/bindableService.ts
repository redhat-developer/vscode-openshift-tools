/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    ActivityBar,
    SideBarView,
    TreeItem,
    VSBrowser,
    ViewSection,
    Workbench,
    before,
} from 'vscode-extension-tester';
import { itemExists, notificationExists, warn, webViewIsOpened } from '../common/conditions';
import { MENUS, NOTIFICATIONS, VIEWS } from '../common/constants';
import { closeAllOpenEditors, collapseViews, reloadWindow } from '../common/overdrives';
import { AddServiceBindingWebView } from '../common/ui/webview/addServiceBinding';
import { CreateServiceWebView, ServiceSetupPage } from '../common/ui/webview/createServiceWebView';

export function bindableServiceTest() {
    describe('Bindable Services', function () {
        const cluster = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
        const clusterName = cluster;

        let view: SideBarView;
        let section: ViewSection;
        let projectName: string;
        let serviceName: string;

        before(async function () {
            this.timeout(30_000);

            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            section = await view.getContent().getSection(VIEWS.appExplorer);

            await closeAllOpenEditors();
            // clearAllNotifications() only clicks "clear all" inside the panel - it doesn't
            // close it, so a left-open Notifications Center can go on to interfere with
            // context menus/quick-picks/webviews rendering for the rest of the suite.
            const notificationsCenter = await new Workbench().openNotificationsCenter();
            await notificationsCenter.clearAllNotifications();
            await notificationsCenter.close();
        });

        after(async function () {
            this.timeout(30_000);
            try {
                const notificationsCenter = await new Workbench().openNotificationsCenter();
                await notificationsCenter.clearAllNotifications();
                await notificationsCenter.close();
            } catch { /* Ignore */ }
            await closeAllOpenEditors();
            await reloadWindow();
        });

        it('Can create operator backed service', async function () {
            this.timeout(150_000);

            //get project, open context menu and select create new operator backed service
            const clusterItem = (await itemExists(clusterName, section)) as TreeItem;
            await clusterItem.expand();
            await clusterItem.getDriver().wait(async () => await clusterItem.hasChildren());
            const children = await clusterItem.getChildren();
            const project = children[0];
            projectName = await project.getLabel();
            const contextMenu = await project.openContextMenu();
            await contextMenu.select(MENUS.create, MENUS.createOperatorBackedService);

            //select service to be created
            const createServiceWebView = new CreateServiceWebView();
            await VSBrowser.instance.driver.wait(async () => {
                try {
                    await createServiceWebView.initializeEditor();
                    return true;
                } catch {
                    return false;
                }
            }, 35_000, 'Create Service webview not initialized');
            await createServiceWebView.clickComboBox();
            await createServiceWebView.selectItemFromComboBox(
                'Cluster',
                'clusters.postgresql.cnpg.io',
            );
            await createServiceWebView.clickNext();

            //finish creating service
            const serviceSetupPage = new ServiceSetupPage();
            await serviceSetupPage.initializeEditor();
            serviceName = await serviceSetupPage.getName();
            await serviceSetupPage.clickSubmit();

            //wait for notification about successful service creation - bootstrapping a
            //PostgreSQL cluster (image pull, initdb, pod startup) can genuinely take well
            //over a minute on a loaded CI Kind cluster.
            await notificationExists(
                NOTIFICATIONS.serviceCreated(serviceName),
                VSBrowser.instance.driver,
                130_000
            );

            //check that deployment is shown
            await project.expand();
            const deployments = (await itemExists('Deployments', section)) as TreeItem;
            await deployments.expand();
            await itemExists(serviceName, section);
        });

        it('Can bind service to a component', async function () {
            this.timeout(75_000);
            const componentName = 'nodejs-starter';
            const bindingName = 'test-binding';
            section = await view.getContent().getSection(VIEWS.components);

            try {
                await itemExists(componentName, section);
            } catch {
                warn(`Component "${componentName}" not found, skipping test`);
                this.skip();
            }

            const component = await section.findItem(componentName);
            let contextMenu = await component.openContextMenu();
            await contextMenu.select(MENUS.bindService);

            const outcome = await Promise.race([
                webViewIsOpened('Add service binding', VSBrowser.instance.driver, 30_000)
                    .then(() => 'webview' as const),
                notificationExists('No bindable services are available', VSBrowser.instance.driver, 30_000)
                    .then(() => 'no-services' as const),
            ]);

            if (outcome === 'no-services') {
                warn('No bindable services are available, skipping test');
                this.skip();
            }

            const addServiceBinding = new AddServiceBindingWebView();
            await addServiceBinding.initializeEditor();
            await addServiceBinding.clickComboBox();
            await addServiceBinding.selectItemFromComboBox(`${projectName}/${serviceName}`);
            await addServiceBinding.setBindingName(bindingName);
            await addServiceBinding.clickAddServiceBindingButton();

            contextMenu = await component.openContextMenu();
            await contextMenu.select(MENUS.startDev);

            await itemExists(`${componentName} (dev starting)`, section);
            await itemExists(`${componentName} (dev running)`, section, 35_000);

            await collapseViews(view, [VIEWS.components]);
            section = await view.getContent().getSection(VIEWS.appExplorer);
            await itemExists(bindingName, section);
        });
    });
}
