/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as fs from 'fs-extra';
import * as pth from 'path';
import { expect } from 'chai';
import { ActivityBar, EditorView, SideBarView, ViewSection, WelcomeContentButton } from 'vscode-extension-tester';
import { VIEWS, BUTTONS } from '../common/constants';
import { CreateComponentWebView, TemplateProjectPage } from '../common/ui/webview/newComponentWebViewEditor';
import { RegistryWebViewDevfileWindow, RegistryWebViewEditor } from '../common/ui/webview/registryWebViewEditor';
import { afterEach } from 'mocha';
import { collapse } from '../common/overdrives';

//TODO: Add more checks for different elements
export function testCreateComponent(path: string) {
    describe('Create Component Wizard', function () {

        let view: SideBarView;
        let section: ViewSection;
        let button: WelcomeContentButton
        let componentName: string

        before(async function context() {
            fs.ensureDirSync(path, 0o6777);
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            for (const item of [VIEWS.appExplorer, VIEWS.compRegistries, VIEWS.serverlessFunctions, VIEWS.debugSessions]) {
                await collapse(await view.getContent().getSection(item))
            }
        });

        beforeEach(async function context() {
            componentName = undefined;
            section = await view.getContent().getSection(VIEWS.components);
            await new EditorView().closeAllEditors();
        })

        it('Shows default actions when no component exists', async function test() {
            const buttons = await (await section.findWelcomeContent()).getButtons();
            for(const btn of buttons) {
                if(await btn.getTitle() === BUTTONS.newComponent) {
                    button = btn;
                }
            }
            if(!button) {
                expect.fail('No Create Component button found')
            }
        })

        it('Create component from git URL');

        it('Create component from local folder');

        it('Create component from template project', async function test() {
            this.timeout(25_000);

            //Click on create component
            await button.click();
            await new Promise((res) => { setTimeout(res, 4_000); });

            //Initialize create component editor and select create from template
            const createCompView = new CreateComponentWebView();
            await createCompView.initializeEditor();
            await createCompView.createComponentFromTemplate();

            //Initialize devfile editor and select stack
            const devfileView = new RegistryWebViewEditor(createCompView.editorName);
            await devfileView.initializeEditor();
            await devfileView.selectRegistryStack('Node.js Runtime');
            await new Promise((res) => { setTimeout(res, 500); });

            //Initialize stack window and click Use Devfile
            const devFileWindow = new RegistryWebViewDevfileWindow(createCompView.editorName);
            await devFileWindow.initializeEditor();
            await devFileWindow.useDevfile();

            //Initialize next page, fill out path and select create component
            const page = new TemplateProjectPage(createCompView.editorName);
            await page.initializeEditor();
            await page.insertProjectFolderPath(path);
            await page.clickCreateComponentButton();
            await new Promise((res  => {setTimeout(res, 7_000)}))

            //check if component is in component view
            componentName = 'nodejs-starter'
            expect(await section.findItem(componentName)).to.be.not.undefined;

        });

        //Delete the component using file system
        afterEach(function context() {
            if(componentName) {
                fs.rmSync(pth.join(path, componentName), {recursive: true, force: true});
            }
        });
    });
}
