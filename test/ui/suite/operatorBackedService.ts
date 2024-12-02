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
import { itemExists, notificationExists } from '../common/conditions';
import { MENUS, NOTIFICATIONS, VIEWS } from '../common/constants';
import { reloadWindow } from '../common/overdrives';
import { CreateServiceWebView, ServiceSetupPage } from '../common/ui/webview/createServiceWebView';

export function operatorBackedServiceTest() {
    describe('Operator-Backed Service', function () {
        const cluster = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
        const clusterName = cluster;

        let view: SideBarView;
        let section: ViewSection;
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
            const contextMenu = await project.openContextMenu();
            await contextMenu.select(MENUS.create, MENUS.createOperatorBackedService);

            //select service to be created
            const createServiceWebView = new CreateServiceWebView();
            await createServiceWebView.initializeEditor();
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
    });
}
