/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    ActivityBar,
    BottomBarPanel,
    EditorView,
    SideBarView,
    TreeItem,
    VSBrowser,
    ViewSection,
    Workbench,
    before,
} from 'vscode-extension-tester';
import { activateCommand } from '../common/command-activator';
import { MENUS, NOTIFICATIONS, VIEWS } from '../common/constants';
import { itemExists, notificationExists } from '../common/conditions';
import { CreateServiceWebView, ServiceSetupPage } from '../common/ui/webview/createServiceWebView';

export function operatorBackedServiceTest() {
    describe('Operator-Backed Service', () => {
        const cluster = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
        const clusterName = cluster;

        let view: SideBarView;
        let section: ViewSection;

        before(async function () {
            this.timeout(30_000)
            /*
            Workaround for not being able to access webview due to
            openshift terminal stealing focus
            */
            const bottomBar = new BottomBarPanel();
            await bottomBar.toggle(false);
            await activateCommand('>Developer: Reload Window');
            await VSBrowser.instance.waitForWorkbench();

            //wait for Activity Bar to be loaded
            await VSBrowser.instance.driver.wait(async () => {
                try {
                    const viewControl = await new ActivityBar().getViewControl(VIEWS.openshift);
                    if (viewControl) {
                        return true;
                    }
                } catch {
                    return null;
                }
            });

            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            section = await view.getContent().getSection(VIEWS.appExplorer);

            await itemExists(clusterName, section);

            await new EditorView().closeAllEditors();
            await (await new Workbench().openNotificationsCenter()).clearAllNotifications();
        });

        it('Can create operator backed service', async () => {
            this.timeout(60_000);

            const clusterItem = await section.findItem(clusterName) as TreeItem;
            await clusterItem.expand();
            await clusterItem.getDriver().wait(async () => await clusterItem.hasChildren());
            const children = await clusterItem.getChildren();
            const project = children[0];
            const contextMenu = await project.openContextMenu();
            await contextMenu.select(MENUS.create, MENUS.createOperatorBackedService);

            const createServiceWebView = new CreateServiceWebView();
            await createServiceWebView.initializeEditor();
            await createServiceWebView.clickComboBox();
            await createServiceWebView.selectItemFromComboBox(
                'Cluster',
                'clusters.postgresql.k8s.enterprisedb.io',
            );
            await createServiceWebView.clickNext();

            const serviceSetupPage = new ServiceSetupPage();
            await serviceSetupPage.initializeEditor();
            const serviceName = await serviceSetupPage.getName();
            await serviceSetupPage.clickSubmit();

            await notificationExists(
                NOTIFICATIONS.serviceCreated(serviceName),
                VSBrowser.instance.driver,
            );
            await project.expand();
            const deployments = await itemExists('Deployments', section) as TreeItem;
            await deployments.expand();
            await itemExists(serviceName, section);
        });

        it.skip('Can bind service to a component', async () => {});

    });
}
