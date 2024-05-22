/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { ActivityBar, EditorView, SideBarView, VSBrowser } from 'vscode-extension-tester';
import { VIEWS } from '../common/constants';
import { collapse } from '../common/overdrives';
import { AddClusterWebView, DevSandboxWebViewPage, LocalClusterWebViewPage } from '../common/ui/webview/addClusterWebView';
import { webViewIsOpened, welcomeContentButtonsAreLoaded } from '../common/conditions';

export function testAddCluster() {
    describe('Add Cluster', function () {

        let view: SideBarView;
        let addClusterView;

        before(async function context() {
            this.timeout(30_000)
            //await new Promise((res) => {setTimeout(res, 20_000)});
            await new EditorView().closeAllEditors();
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            for (const item of [VIEWS.components, VIEWS.compRegistries, VIEWS.serverlessFunctions, VIEWS.debugSessions]) {
                await collapse(await view.getContent().getSection(item))
            }
        });

        it('Page with options is shown', async function test() {
            this.timeout(70_000);
            //await new Promise((res) => {setTimeout(res, 15_000)});
            const section = await view.getContent().getSection(VIEWS.appExplorer);
            const welcomeContent = await section.findWelcomeContent();
            const buttons = await welcomeContentButtonsAreLoaded(welcomeContent);
            await buttons[2].click();

            addClusterView = new AddClusterWebView();
            await webViewIsOpened(addClusterView.editorName, VSBrowser.instance.driver);

            await addClusterView.initializeEditor();
            await addClusterView.checkRosaButton();
            await addClusterView.checkLearningButton();
        });

        it('Local Cluster Page shows appropriate content', async function test() {
            await addClusterView.addLocalCluster();
            const localClusterPage = new LocalClusterWebViewPage();
            await localClusterPage.initializeEditor();
            await localClusterPage.checkText();
            await localClusterPage.checkDownloadButton();
            await localClusterPage.checkPathButton();
            await localClusterPage.clickBack();
        });

        it('Developer Sandbox Page shows appropriate content', async function test() {
            await addClusterView.addDevSandbox();
            const devSandboxWebViewPage = new DevSandboxWebViewPage();
            await devSandboxWebViewPage.initializeEditor();
            await devSandboxWebViewPage.checkText();
            await devSandboxWebViewPage.checkLoginButton();
            await devSandboxWebViewPage.checkSignUpButton();
            await devSandboxWebViewPage.clickBack();
        });
    });
}