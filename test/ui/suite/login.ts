/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { ActivityBar, InputBox, SideBarView, VSBrowser, ViewSection } from 'vscode-extension-tester';
import { activateCommand } from '../common/command-activator';
import { itemExists, notificationExists } from '../common/conditions';
import { INPUTS, NOTIFICATIONS, VIEWS } from '../common/constants';
import { collapse } from '../common/overdrives';

export function loginTest() {
    describe('Login', function () {
        const user = process.env.CLUSTER_USER || 'developer';
        const password = process.env.CLUSTER_PASSWORD || 'developer';
        const cluster = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
        const clusterName = cluster;

        let explorer: ViewSection;
        let view: SideBarView;

        before(async function context() {
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            explorer = await view.getContent().getSection(VIEWS.appExplorer);
            await explorer.expand();
        });

        it('Login works when kube config is missing', async function test() {
            this.timeout(30_000);

            const content = await explorer.findWelcomeContent();
            const welcomeContentButtons = await content.getButtons();
            const loginButton = welcomeContentButtons[0];

            await loginButton.click();

            await login(true, false);

            // don't save the credentials when asked
            await saveCredentials(INPUTS.no);

            // wait for confirmation that the login was successful
            await notificationExists(NOTIFICATIONS.loginSuccess(cluster), VSBrowser.instance.driver, 15_000);

            // make sure the cluster shows up in the tree view
            const clusterItem = await itemExists(clusterName, explorer);
            expect(clusterItem).to.be.not.undefined;
        });

        it('Logout works', async function test() {
            await logout(INPUTS.no);
            await new Promise((res) => { setTimeout(res, 1_500); });
            const content = await explorer.findWelcomeContent();
            expect(content).to.be.not.undefined;
        });

        it('Credentials can be saved', async function test() {
            this.timeout(30_000);

            explorer = await view.getContent().getSection(VIEWS.appExplorer);
            await collapse(explorer);
            //await explorer.collapse();
            await explorer.expand();

            const action = await explorer.getAction('Login into Cluster');
            await action.click();

            await login(false, false);
            await saveCredentials(INPUTS.yes);

            await notificationExists(NOTIFICATIONS.loginSuccess(cluster), VSBrowser.instance.driver, 15_000);
            let clusterItem = await itemExists(clusterName, explorer);
            expect(clusterItem).to.be.not.undefined;

            await logout(INPUTS.yes);
            await login(false, true);

            await notificationExists(NOTIFICATIONS.loginSuccess(cluster), VSBrowser.instance.driver, 15_000);
            clusterItem = await itemExists(clusterName, explorer);
            expect(clusterItem).to.be.not.undefined;
        });

        async function login(firstLogin: boolean, savedPassword: boolean) {

            // select new URL
            let inputBox = await InputBox.create();
            if (firstLogin) {
                await inputBox.selectQuickPick(INPUTS.newUrlQuickPick);

                // provide the cluster URL
                await inputBox.setText(cluster);
                await inputBox.confirm();
            } else {
                await inputBox.selectQuickPick(clusterName);
            }

            //select credentials login
            inputBox = await InputBox.create();
            await inputBox.selectQuickPick(INPUTS.credentialsQuickPick);

            // set credentials
            if (firstLogin) {
                await inputBox.selectQuickPick(INPUTS.newUserQuickPick);
                // provide user name
                await inputBox.setText(user);
                await inputBox.confirm();
            } else {
                await inputBox.selectQuickPick(user);
            }

            // provide password
            if (!savedPassword) {
                await inputBox.setText(password);
            }

            await inputBox.confirm();
        }

        async function saveCredentials(option: string) {
            const notification = await notificationExists(NOTIFICATIONS.savePasswordPrompt, VSBrowser.instance.driver,);
            await notification.takeAction(option);
        }

        async function logout(option: string) {
            await activateCommand('>OpenShift: Log out');

            let notification = await notificationExists(NOTIFICATIONS.doYouWantLogOut, VSBrowser.instance.driver);
            await notification.takeAction(INPUTS.logout);

            notification = await notificationExists(NOTIFICATIONS.logoutSuccess, VSBrowser.instance.driver);
            await notification.takeAction(option);
        }
    });
}
