/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { expect } from 'chai';
import * as fs from 'fs-extra';
import {
    ActivityBar,
    InputBox,
    NotificationType,
    QuickPickItem,
    SideBarView,
    TreeItem,
    VSBrowser,
    ViewSection,
    WelcomeContentButton,
    Workbench,
    after,
    before,
    beforeEach
} from 'vscode-extension-tester';
import { parse } from 'yaml';
import { activateCommand } from '../common/command-activator';
import { itemExists, notificationExists } from '../common/conditions';
import { ACTIONS, INPUTS, NOTIFICATIONS, VIEWS } from '../common/constants';
import { addKubeContext, getKubeConfigContent, getKubeConfigPath } from '../common/kubeConfigUtils';
import { closeAllOpenEditors, collapse } from '../common/overdrives';

export function kubernetesContextTest(isOpenshiftCluster: boolean) {
    describe('Kubernetes Context', function () {
        const cluster = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
        const clusterName = cluster;

        let view: SideBarView;
        let explorer: ViewSection;

        let quickPicks: QuickPickItem[];
        const allQuickPicksLabels: string[] = [];
        const allQuickPicksTexts: string[] = [];

        const kubeCopy = `${getKubeConfigPath()}-cp`;

        before(async function () {
            this.timeout(30_000);
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
            const kubeYaml = parse(kubeContent) as { [key: string]: any };
            addKubeContext(
                kubeYaml.contexts[0].context.cluster,
                'test-namespace',
                kubeYaml.contexts[0].context.user,
                'test-name',
            );
        });

        //put original kubeconfig back
        after(async function () {
            this.timeout(15_000);

            // fs.moveSync() is a rename (delete+create) - the extension's kube-context cache
            // is only refreshed by its file watcher's onDidChange handler, which explicitly
            // ignores create/delete events, so a rename can be silently missed and leave the
            // cached context stale for whatever test runs next. Overwrite the file content
            // in place instead, which the watcher reliably picks up as a genuine change (same
            // as addKubeContext() above does via writeFileSync), then give its ~500ms debounce
            // time to actually process it before forcing a tree refresh.
            const kubeContent = fs.readFileSync(kubeCopy, 'utf-8');
            fs.writeFileSync(getKubeConfigPath(), kubeContent);
            fs.removeSync(kubeCopy);
            await new Promise((res) => setTimeout(res, 1_500));

            const actions = await explorer.getActions();
            await actions[3].click();
        });

        beforeEach(async function () {
            // openNotificationsCenter() always opens the panel, so it must always be closed
            // again here too - closing only "if notifications.length > 0" leaves it open
            // (and able to interfere with later command palette/webview rendering) whenever
            // there happen to be none.
            const notificationCenter = await new Workbench().openNotificationsCenter();
            await notificationCenter.getNotifications(NotificationType.Any);
            await notificationCenter.close();
            await closeAllOpenEditors();
        });

        it('Select kubernetes context', async function () {
            this.timeout(20_000);

            await explorer.expand();

            const welcomeContent = await explorer.findWelcomeContent();
            const buttons: WelcomeContentButton[] = await welcomeContent.getButtons();
            const contextButton = buttons[1];

            await contextButton.click();

            let inputBox = await InputBox.create();
            quickPicks = await inputBox.getQuickPicks();

            expect(quickPicks).is.not.empty;

            for (let i = 0; i < quickPicks.length; i++) {
                allQuickPicksLabels[i] = await quickPicks[i].getLabel();
                allQuickPicksTexts[i] = await quickPicks[i].getText();
            }

            const quickPickText = allQuickPicksTexts[0];

            // Find project name for QuickPick Item #0
            // Example quickPick text: [... Project: test-namespace, User: kind-kind]
            const project = quickPickText.split(',')[0]; // Left: [... Project: test-namespace]
            const projectName = project.split(':')[1].trim(); // Left [test-namespace]

            // Select QuickPick Item #0
            await inputBox.selectQuickPick(allQuickPicksLabels[0]);

            if (isOpenshiftCluster) {
                inputBox = await InputBox.create();
                await inputBox.selectQuickPick(INPUTS.credentialsQuickPick);
                await inputBox.selectQuickPick('developer');
                await inputBox.confirm();
            }

            // Check project name appeared on the App. Tree
            const clusterNode = (await itemExists(clusterName, explorer)) as TreeItem;
            await clusterNode.expand();
            await itemExists(projectName, explorer);
        });

        it('Switch context', async function () {
            this.timeout(20_000);

            const quickPickText = allQuickPicksTexts[1]; // Use the second context of two
            // Example quickPick text: [... Project: test-namespace, User: kind-kind]
            const project = quickPickText.split(',')[0]; // Left: [... Project: test-namespace]
            const projectName = project.split(':')[1].trim(); // Left [test-namespace]

            await collapse(explorer);
            await explorer.expand();

            const action = await explorer.getAction(ACTIONS.switchContexts);
            await action.click();

            const inputBox = await InputBox.create();
            await inputBox.selectQuickPick(allQuickPicksLabels[1]); // Swtich to the second context of two

            await itemExists(projectName, explorer);
        });
    });
}
