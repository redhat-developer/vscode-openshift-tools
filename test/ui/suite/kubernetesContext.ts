/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { ActivityBar, EditorView, InputBox, NotificationType, QuickPickItem, SideBarView, TreeItem, VSBrowser, ViewSection, Workbench } from 'vscode-extension-tester';
import { ACTIONS, INPUTS, NOTIFICATIONS, VIEWS } from '../common/constants';
import { activateCommand } from '../common/command-activator';
import { itemExists, notificationExists } from '../common/conditions';
import { expect } from 'chai';
import { collapse } from '../common/overdrives';

export function kubernetesContextTest() {
    describe('Kubernetes Context', function () {

        const cluster = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
        const clusterName = cluster;

        let view: SideBarView;
        let explorer: ViewSection;

        let quickPicks: QuickPickItem[];
        const allQuickPicksTexts: string[] = [];

        before(async function() {
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            explorer = await view.getContent().getSection(VIEWS.appExplorer);
            await activateCommand('>OpenShift: Log out');
            let notification = await notificationExists(NOTIFICATIONS.doYouWantLogOut, VSBrowser.instance.driver);
            await notification.takeAction(INPUTS.logout);
            notification = await notificationExists(NOTIFICATIONS.logoutSuccess, VSBrowser.instance.driver);
            await notification.takeAction(INPUTS.no);
            await new Promise((res) => { setTimeout(res, 1_500); });
        });

        beforeEach(async function () {
            const notificationCenter = await new Workbench().openNotificationsCenter();
            const notifications = await notificationCenter.getNotifications(NotificationType.Any);
            if (notifications.length > 0) {
                await notificationCenter.close();
            }
            await new EditorView().closeAllEditors();
        });

        it('Select kubernetes context', async function() {
            this.timeout(20_000);

            await explorer.expand();

            const welcomeContent = await explorer.findWelcomeContent();
            const buttons = await welcomeContent.getButtons();
            const contextButton = buttons[1];

            await contextButton.click();

            let inputBox = await InputBox.create();
            quickPicks = await inputBox.getQuickPicks();

            expect(quickPicks).is.not.empty;

            for(let i = 0; i < quickPicks.length; i++) {
                allQuickPicksTexts[i] = await quickPicks[i].getText();
            }
            const quickPickText = allQuickPicksTexts[0];
            const projectName = quickPickText.split('on')[0];
            console.log(projectName)

            console.log('A')
            await inputBox.selectQuickPick(projectName);

            console.log('B')
            inputBox = await InputBox.create();
            console.log('C')
            await inputBox.selectQuickPick(INPUTS.credentialsQuickPick);
            console.log('D')
            await inputBox.selectQuickPick('developer');
            console.log('E')
            await inputBox.confirm();
            console.log('F')


            console.log('hereeee')
            const clusterNode = await itemExists(clusterName, explorer) as TreeItem;
            console.log('1')
            await clusterNode.expand();
            console.log('2')
            await itemExists(projectName, explorer);
            console.log('3')
        });

        it('Switch context', async function() {
            this.timeout(20_000);

            console.log('1')
            const quickPickText = allQuickPicksTexts[1];
            //console.log(quickPickText)
            const projectName = quickPickText.split('on')[0];

            console.log('2')
            await collapse(explorer);
            console.log('3')
            await explorer.expand();
            console.log('4')

            const action = await explorer.getAction(ACTIONS.switchContexts);
            console.log('5')
            await action.click();
            console.log('6')

            const inputBox = await InputBox.create();
            console.log('7')
            await inputBox.selectQuickPick(projectName);
            console.log('8')

            await itemExists(projectName, explorer);
            console.log('9')
        });
    });

}