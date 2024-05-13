/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { ActivityBar, EditorView, SideBarView } from 'vscode-extension-tester';
import { VIEWS } from '../common/constants';
import { collapse } from '../common/overdrives';
import { AddClusterWebView } from '../common/ui/webview/addClusterWebView';

export function testAddCluster() {
    describe('Add Cluster', function () {

        let view: SideBarView;

        before(async function context() {
            await new EditorView().closeAllEditors();
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            for (const item of [VIEWS.components, VIEWS.compRegistries, VIEWS.serverlessFunctions, VIEWS.debugSessions]) {
                await collapse(await view.getContent().getSection(item))
            }
        });

        it('Page with options is shown', async function test() {
            this.timeout(15_000);
            await new Promise((res) => {setTimeout(res, 6_000)});
            const section = await view.getContent().getSection(VIEWS.appExplorer);
            const buttons = await (await section.findWelcomeContent()).getButtons();
            await buttons[2].click();

            const addClusterView = new AddClusterWebView();
            await addClusterView.initializeEditor();
            await addClusterView.addLocalCluster();
        })
    })
}