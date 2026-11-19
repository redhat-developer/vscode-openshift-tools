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
import { notificationExists, itemExists } from '../common/conditions';
import { MENUS, NOTIFICATIONS, VIEWS } from '../common/constants';
import { closeAllOpenEditors, collapseViews, reloadWindow } from '../common/overdrives';
import { AddServiceBindingWebView } from '../common/ui/webview/addServiceBinding';
import { CreateServiceWebView, ServiceSetupPage } from '../common/ui/webview/createServiceWebView';
import {
    FIXTURE_SERVICE,
    getCurrentNamespace,
    installServiceBindingFixture,
    removeServiceBindingFixture,
} from '../common/serviceBindingFixture';

export function bindableServiceTest() {
    describe('Bindable Services', function () {
        const cluster = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
        const clusterName = cluster;
        const componentName = 'nodejs-starter';
        const bindingName = 'test-binding';

        let view: SideBarView;
        let section: ViewSection;
        let serviceName: string;

        // shared state between the dependent bind/list/remove tests below:
        // each test skips itself when a step it depends on did not complete
        let devRunning = false;
        let bindingCreated = false;

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
                removeServiceBindingFixture();
            } catch { /* best effort */ }
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
            this.timeout(240_000);

            // install a Provisioned Service fixture in the active project: the CNPG
            // Cluster created above does not implement the Provisioned Service
            // pattern (.status.binding) and is not bindable
            installServiceBindingFixture();
            const namespace = getCurrentNamespace();

            // a lingering notification from the previous test can overlay the
            // workbench; clear it the same way the suite's before() hook does
            const notificationsCenter = await new Workbench().openNotificationsCenter();
            await notificationsCenter.clearAllNotifications();
            await notificationsCenter.close();

            const componentsSection = await view.getContent().getSection(VIEWS.components);
            const component = await itemExists(componentName, componentsSection, 60_000);

            // the binding is projected onto the component's workload, so the
            // component must be running in dev mode first
            let contextMenu = await component.openContextMenu();
            await contextMenu.select(MENUS.startDev);

            await itemExists(`${componentName} (dev starting)`, componentsSection, 30_000);
            await itemExists(`${componentName} (dev running)`, componentsSection, 120_000);
            devRunning = true;

            // bind the fixture service to the component; while dev mode is
            // running, the component's label carries the state suffix
            const componentInDevName = `${componentName} (dev running)`;
            contextMenu = await (await itemExists(componentInDevName, componentsSection, 30_000)).openContextMenu();
            await contextMenu.select(MENUS.bindService);

            await notificationExists(NOTIFICATIONS.lookingForBindableServices, VSBrowser.instance.driver, 10_000)
                .catch(() => { /* the progress notification may already be gone */ });

            const addServiceBinding = new AddServiceBindingWebView();
            // the extension runs service discovery before creating the panel,
            // so the editor tab may not exist yet on a slow runner —
            // getTabByTitle throws immediately instead of waiting
            await VSBrowser.instance.driver.wait(async () => {
                try {
                    await addServiceBinding.initializeEditor();
                    return true;
                } catch {
                    return false;
                }
            }, 60_000, 'Add Service Binding webview not initialized');
            await addServiceBinding.clickComboBox();
            await addServiceBinding.selectItemFromComboBox(
                `${FIXTURE_SERVICE.kind}: ${namespace}/${FIXTURE_SERVICE.name}`,
            );
            await addServiceBinding.setBindingName(bindingName);
            await addServiceBinding.clickAddServiceBindingButton();

            await notificationExists(
                NOTIFICATIONS.bindingCreated(bindingName),
                VSBrowser.instance.driver,
                60_000
            );

            bindingCreated = true;
        });

        it('Can list service bindings of a component', async function () {
            if (!bindingCreated) {
                this.skip();
            }
            this.timeout(60_000);

            // while dev mode is running, the component's label carries the state suffix
            const componentInDevName = `${componentName} (dev running)`;
            const componentsSection = await view.getContent().getSection(VIEWS.components);
            const componentItem = (await itemExists(componentInDevName, componentsSection, 30_000)) as TreeItem;
            await componentItem.expand();
            const bindingsNode = (await itemExists('Service Bindings', componentsSection, 30_000)) as TreeItem;
            await bindingsNode.expand();
            await itemExists(bindingName, componentsSection, 30_000);
        });

        it('Can remove service binding from a component', async function () {
            if (!bindingCreated) {
                this.skip();
            }
            this.timeout(120_000);

            const componentsSection = await view.getContent().getSection(VIEWS.components);
            const bindingItem = (await itemExists(bindingName, componentsSection, 30_000)) as TreeItem;
            const contextMenu = await bindingItem.openContextMenu();
            await contextMenu.select(MENUS.removeServiceBinding);

            await notificationExists(
                NOTIFICATIONS.bindingRemoved(bindingName),
                VSBrowser.instance.driver,
                60_000
            );

            await VSBrowser.instance.driver.wait(async () => {
                return (await componentsSection.findItem(bindingName)) === undefined;
            }, 30_000, `Expected binding '${bindingName}' to disappear from the Components view`);
        });

        it('Stop dev mode', async function () {
            if (!devRunning) {
                this.skip();
            }
            this.timeout(120_000);

            // while dev mode is running, the component's label carries the state suffix
            const componentInDevName = `${componentName} (dev running)`;
            const componentsSection = await view.getContent().getSection(VIEWS.components);
            const contextMenu = await (await itemExists(componentInDevName, componentsSection, 30_000)).openContextMenu();
            await contextMenu.select(MENUS.stopDev);

            await itemExists(`${componentName} (dev stopping)`, componentsSection, 10_000)
                .catch(() => { /* the stopping phase can be quick enough to miss */ });
            await itemExists(componentName, componentsSection, 60_000);

            await collapseViews(view, [VIEWS.components]);
            section = await view.getContent().getSection(VIEWS.appExplorer);
        });
    });
}
