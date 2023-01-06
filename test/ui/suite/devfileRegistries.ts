/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { expect } from 'chai';
import { ActivityBar, CustomTreeSection, EditorView, InputBox, SideBarView, VSBrowser, ViewSection, WebDriver, Workbench } from 'vscode-extension-tester';
import { VIEWS } from '../common/constants';
import { RegistryWebViewEditor } from '../common/ui/webview/registryWebViewEditor';
import { notificationExists } from '../common/conditions';

export function testDevfileRegistries() {
    describe('Devfile Registries', () => {
        let view: SideBarView;
        let registrySection: ViewSection;
        let driver: WebDriver;

        before(async function context() {
            this.timeout(10000);
            driver = VSBrowser.instance.driver;
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            await new Promise(res => setTimeout(res, 5000));
            await (await new Workbench().openNotificationsCenter()).clearAllNotifications();
            registrySection = await view.getContent().getSection(VIEWS.compRegistries);
        });

        it('registry actions are available', async function test() {
            this.timeout(5000);
            expect(await Promise.all((await registrySection.getActions()).map(async item => await item.getLabel()))).to.has.members(['Add Registry', 'Open Registry View', 'Refresh Components Types View']);
        });

        it('default Devfile registry is present', async function test() {
            this.timeout(5000);
            await registrySection.expand();
            const registry = await registrySection.findItem(VIEWS.devFileRegistry);
            expect(registry).not.undefined;
            expect(await registry.getText()).to.equal('DefaultDevfileRegistry');
        });

        it('add new Devfile registry', async function test() {
            this.timeout(10000);
            const addAction = await registrySection.getAction('Add Registry');
            await addAction.click();
            const input = await InputBox.create();
            // insert registry name into input box
            await input.setText('stageRegistry');
            await input.confirm();
            // insert staging devfile registry url
            await input.setText('https://stage.registry.devfile.io');
            await input.confirm();
            // pick unsecured registry
            await input.selectQuickPick('No');
            await new Promise((res) => { setTimeout(res, 2000); });
            // check registry exists
            await registrySection.expand();
            const stageRegistry = await (registrySection as CustomTreeSection).findItem('stageRegistry');
            expect(stageRegistry).not.undefined;
        });

        it('edit existing Devfile registry', async function test() {
            this.timeout(10000);
            await registrySection.expand();
            const stageRegistry = await (registrySection as CustomTreeSection).findItem('stageRegistry');
            const menu = await stageRegistry.openContextMenu();
            await (await menu.getItem('Edit')).select();
            const input = await InputBox.create();
            // insert registry name into input box
            await input.setText('editedRegistry');
            await input.confirm();
            // insert staging devfile registry url
            await input.setText('https://stage.registry.devfile.io');
            await input.confirm();
            // pick unsecured registry
            await input.selectQuickPick('No');
            await new Promise((res) => { setTimeout(res, 2000); });
            // check registry exists
            await registrySection.expand();
            const editedRegistry = await (registrySection as CustomTreeSection).findItem('editedRegistry');
            expect(editedRegistry).not.undefined;
        });

        it('remove Devfile registry', async function test() {
            this.timeout(10000);
            await registrySection.expand();
            let stageRegistry = await registrySection.findItem('editedRegistry');
            const menu = await stageRegistry.openContextMenu();
            await (await menu.getItem('Remove')).select();
            // find and confirm notification about registry deletion
            const notification = await notificationExists('Remove registry \'editedRegistry\'?', driver);
            await notification.takeAction('Yes');
            await new Promise((res) => { setTimeout(res, 2000); });
            stageRegistry = await registrySection.findItem('editedRegistry');
            expect(stageRegistry).is.undefined;
        });

        it('open Devfile registry view from Section action', async function test() {
            this.timeout(10000);
            await (await registrySection.getAction('Open Registry View')).click();
            // open editor tab by title
            const editorView = new EditorView();
            const editor = await editorView.openEditor('Devfile Registry');
            expect(await editor.getTitle()).to.include('Devfile Registry');
        });

        it('open Devfile registry view from item\'s context menu and verify the content of the registry', async function test() {
            this.timeout(10000);
            await new EditorView().closeAllEditors();
            const devfileRegistry = await registrySection.findItem('DefaultDevfileRegistry');
            await devfileRegistry.select();
            const menu = await devfileRegistry.openContextMenu();
            await (await menu.getItem('Open in Editor')).select();
            await new Promise((res) => { setTimeout(res, 3000); });
            // check opened editor tab by title
            const editorView = new EditorView();
            const editor = await editorView.openEditor('Devfile Registry - DefaultDevfileRegistry');
            expect(await editor.getTitle()).to.include('Devfile Registry - DefaultDevfileRegistry');
            // initialize web view editor
            const webView = new RegistryWebViewEditor('Devfile Registry - DefaultDevfileRegistry');
            await webView.initializeEditor();
            expect(await webView.getRegistryStackNames()).to.include.members(['Quarkus Java', 'Node.js Runtime', 'Python', 'Maven Java', 'Vert.x Java', 'Go Runtime', 'React']);
        });

        after(async function context() {
            this.timeout(10000);
            await (await new Workbench().openNotificationsCenter()).clearAllNotifications();
            await new EditorView().closeAllEditors();
        });

    });
}
