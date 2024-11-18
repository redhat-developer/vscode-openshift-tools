/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { expect } from 'chai';
import {
    ActivityBar,
    EditorView,
    InputBox,
    NotificationType,
    QuickPickItem,
    SideBarView,
    TreeItem,
    VSBrowser,
    ViewSection,
    Workbench,
    before,
    beforeEach,
    after,
} from 'vscode-extension-tester';
import { activateCommand } from '../common/command-activator';
import { itemExists, notificationExists } from '../common/conditions';
import { ACTIONS, INPUTS, NOTIFICATIONS, VIEWS } from '../common/constants';
import { collapse } from '../common/overdrives';
import { addKubeContext, getKubeConfigContent, getKubeConfigPath } from '../common/kubeConfigUtils';
import * as fs from 'fs-extra';
import * as yml from 'js-yaml';

export function kubernetesContextTest(isOpenshiftCluster: boolean) {
    describe('Kubernetes Context', function () {
        const cluster = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
        const clusterName = cluster;

        let view: SideBarView;
        let explorer: ViewSection;

        let quickPicks: QuickPickItem[];
        const allQuickPicksTexts: string[] = [];

        const kubeCopy = `${getKubeConfigPath()}-cp`;

        before(async function () {
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            explorer = await view.getContent().getSection(VIEWS.appExplorer);

            //make kubeconfig copy
            fs.copySync(getKubeConfigPath(), kubeCopy);

            await activateCommand('>OpenShift: Log out');

            let notification = await notificationExists(
                NOTIFICATIONS.doYouWantLogOut,
                VSBrowser.instance.driver,
            );
            await notification.takeAction(INPUTS.logout);
            notification = await notificationExists(
                NOTIFICATIONS.logoutSuccess,
                VSBrowser.instance.driver,
            );
            await notification.takeAction(INPUTS.no);
            await new Promise((res) => {
                setTimeout(res, 1_500);
            });

            //add kube context for test
            const kubeContent = getKubeConfigContent();
            const kubeYaml = yml.load(kubeContent) as { [key: string]: any };
            addKubeContext(
                kubeYaml.contexts[0].context.cluster,
                'test-namespace',
                kubeYaml.contexts[0].context.user,
                'test-name',
            );
        });

        //put original kubeconfig back
        after(async () => {
            fs.moveSync(kubeCopy, getKubeConfigPath(), { overwrite: true });
            const actions = await explorer.getActions();
            await actions[3].click();
        });

        beforeEach(async function () {
            const notificationCenter = await new Workbench().openNotificationsCenter();
            const notifications = await notificationCenter.getNotifications(NotificationType.Any);
            if (notifications.length > 0) {
                await notificationCenter.close();
            }
            await new EditorView().closeAllEditors();
        });

        it('Select kubernetes context', async function () {
            this.timeout(20_000);

            await explorer.expand();

            const welcomeContent = await explorer.findWelcomeContent();
            const buttons = await welcomeContent.getButtons();
            const contextButton = buttons[1];

            await contextButton.click();

            let inputBox = await InputBox.create();
            quickPicks = await inputBox.getQuickPicks();

            expect(quickPicks).is.not.empty;

            for (let i = 0; i < quickPicks.length; i++) {
                allQuickPicksTexts[i] = await quickPicks[i].getText();
            }

            const quickPickText = allQuickPicksTexts[0];
            const project = quickPickText.match(/\w+/)[0];
            const projectName = project.split('on')[0];

            await inputBox.selectQuickPick(projectName);

            if (isOpenshiftCluster) {
                inputBox = await InputBox.create();
                await inputBox.selectQuickPick(INPUTS.credentialsQuickPick);
                await inputBox.selectQuickPick('developer');
                await inputBox.confirm();
            }

            const clusterNode = (await itemExists(clusterName, explorer)) as TreeItem;
            await clusterNode.expand();
            await itemExists(projectName, explorer);
        });

        it('Switch context', async function () {
            this.timeout(20_000);

            const quickPickText = allQuickPicksTexts[1];
            const projectName = quickPickText.split('on')[0];

            await collapse(explorer);
            await explorer.expand();

            const action = await explorer.getAction(ACTIONS.switchContexts);
            await action.click();

            const inputBox = await InputBox.create();
            await inputBox.selectQuickPick(projectName);

            await itemExists(projectName, explorer);
        });
    });
}
