/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { ActivityBar, EditorView, SideBarView, VSBrowser } from 'vscode-extension-tester';
import { VIEWS } from '../common/constants';
import { closeAllOpenEditors, collapse } from '../common/overdrives';
import { AddClusterWebView, DevSandboxWebViewPage, LocalClusterWebViewPage } from '../common/ui/webview/addClusterWebView';
import { webViewIsOpened, welcomeContentButtonsAreLoaded } from '../common/conditions';

/**
 * Polls getOpenEditorTitles() instead of trusting that the tab exists the instant
 * webViewIsOpened()/the triggering click resolves - VS Code needs real time to finish
 * opening and rendering the editor.
 */
async function waitForEditorTitle(title: string, timeout = 15_000, pollInterval = 1_000): Promise<void> {
    const editorView = new EditorView();
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const openEditorTitles = await editorView.getOpenEditorTitles();
        if (openEditorTitles.includes(title)) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
    throw new Error(`Timed out after ${timeout}ms waiting for editor tab "${title}" to open`);
}

export function testAddCluster() {
    describe('Add Cluster', function () {

        let view: SideBarView;

        /**
         * Opens the Add Cluster webview from a clean slate. VS Code webview panels use
         * retainContextWhenHidden, so a stray Welcome tab's iframe stays in the DOM even
         * after it's no longer the active tab - and WebView's frame-picking logic (matching
         * bounding rects) can lock onto it instead of the Add Cluster iframe. Closing all
         * editors first guarantees only one webview iframe exists when we switch into it.
         */
        async function openAddClusterView(): Promise<AddClusterWebView> {
            await closeAllOpenEditors();

            const section = await view.getContent().getSection(VIEWS.appExplorer);
            const welcomeContent = await section.findWelcomeContent();
            const buttons = await welcomeContentButtonsAreLoaded(welcomeContent);
            await buttons[2].click();

            const addClusterView = new AddClusterWebView();
            await webViewIsOpened(addClusterView.editorName, VSBrowser.instance.driver);
            await waitForEditorTitle(addClusterView.editorName);

            await addClusterView.initializeEditor();
            return addClusterView;
        }

        before(async function context() {
            this.timeout(30_000)
            await closeAllOpenEditors();
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();

            for (const item of [VIEWS.components, VIEWS.compRegistries, VIEWS.serverlessFunctions, VIEWS.debugSessions]) {
                await collapse(await view.getContent().getSection(item))
            }
        });

        it('Page with options is shown', async function test() {
            this.timeout(30_000);
            const addClusterView = await openAddClusterView();
            await addClusterView.checkRosaButton();
            await addClusterView.checkLearningButton();
        });

        it('Local Cluster Page shows appropriate content', async function test() {
            this.timeout(40_000);
            const addClusterView = await openAddClusterView();
            await addClusterView.addLocalCluster();
            const localClusterPage = new LocalClusterWebViewPage();
            await localClusterPage.initializeEditor();
            await localClusterPage.checkText();
            await localClusterPage.checkDownloadButton();
            await localClusterPage.checkPathButton();
            await localClusterPage.clickBack();
        });

        it('Developer Sandbox Page shows appropriate content', async function test() {
            this.timeout(40_000);
            const addClusterView = await openAddClusterView();
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