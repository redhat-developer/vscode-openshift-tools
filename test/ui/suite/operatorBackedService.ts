/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    ActivityBar,
    EditorView,
    SideBarView,
    TreeItem,
    VSBrowser,
    ViewSection,
    Workbench,
    before,
} from 'vscode-extension-tester';
import { MENUS, NOTIFICATIONS, VIEWS } from '../common/constants';
import { itemExists, notificationDoesNotExist, notificationExists } from '../common/conditions';
import { CreateServiceWebView, ServiceSetupPage } from '../common/ui/webview/createServiceWebView';
import { AddServiceBindingWebView } from '../common/ui/webview/addServiceBinding';
import { reloadWindow } from '../common/overdrives';

export function operatorBackedServiceTest() {
    describe('Operator-Backed Service', function () {
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

            await new EditorView().closeAllEditors();
            await (await new Workbench().openNotificationsCenter()).clearAllNotifications();
        });

        after(async function () {
            await reloadWindow();
        });

        it('Can create operator backed service', async function () {
            this.timeout(60_000);

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
            await createServiceWebView.initializeEditor();
            await createServiceWebView.clickComboBox();
            await createServiceWebView.selectItemFromComboBox(
                'Cluster',
                'clusters.postgresql.k8s.enterprisedb.io',
            );
            await createServiceWebView.clickNext();

            //finish creating service
            const serviceSetupPage = new ServiceSetupPage();
            await serviceSetupPage.initializeEditor();
            serviceName = await serviceSetupPage.getName();
            await serviceSetupPage.clickSubmit();

            //wait for notification about successful service creation
            await notificationExists(
                NOTIFICATIONS.serviceCreated(serviceName),
                VSBrowser.instance.driver,
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
                this.skip();
            }

            //open context menu on component and click bind service
            const component = await section.findItem(componentName);
            let contextMenu = await component.openContextMenu();
            await contextMenu.select(MENUS.bindService);

            //wait for look for available services to be completed
            await notificationDoesNotExist(
                NOTIFICATIONS.lookingForBindableServices,
                VSBrowser.instance.driver,
            );

            //select service to bind
            const addServiceBinding = new AddServiceBindingWebView();
            await addServiceBinding.initializeEditor();
            await addServiceBinding.clickComboBox();
            await addServiceBinding.selectItemFromComboBox(`${projectName}/${serviceName}`);
            await addServiceBinding.setBindingName(bindingName);
            await addServiceBinding.clickAddServiceBindingButton();

            //start dev on component
            contextMenu = await component.openContextMenu();
            await contextMenu.select(MENUS.startDev);

            //wait for start dev to finish
            await itemExists(`${componentName} (dev starting)`, section);
            await itemExists(`${componentName} (dev running)`, section, 35_000);

            //check service binding is shown in deployments
            await section.collapse();
            section = await view.getContent().getSection(VIEWS.appExplorer);
            await itemExists(bindingName, section);
        });
    });
}
