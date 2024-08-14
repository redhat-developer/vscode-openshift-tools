/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import * as fs from 'fs-extra';
import { afterEach } from 'mocha';
import * as pth from 'path';
import {
    ActivityBar,
    EditorView,
    InputBox,
    NotificationType,
    SideBarView,
    ViewSection,
    WelcomeContentButton,
    Workbench,
} from 'vscode-extension-tester';
import { BUTTONS, VIEWS } from '../common/constants';
import { collapse } from '../common/overdrives';
import {
    CreateComponentWebView,
    GitProjectPage,
    LocalCodeBasePage,
    SetNameAndFolderPage,
} from '../common/ui/webview/newComponentWebViewEditor';
import {
    RegistryWebViewDevfileWindow,
    RegistryWebViewEditor,
} from '../common/ui/webview/registryWebViewEditor';

//TODO: Add more checks for different elements
export function testCreateComponent(path: string) {
    describe('Create Component Wizard', function () {
        let view: SideBarView;
        let section: ViewSection;
        let button: WelcomeContentButton;
        let componentName: string;
        let dlt = true;

        before(async function context() {
            this.timeout(10_000);
            await new EditorView().closeAllEditors();
            fs.ensureDirSync(path, 0o6777);
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            for (const item of [
                VIEWS.appExplorer,
                VIEWS.compRegistries,
                VIEWS.serverlessFunctions,
                VIEWS.debugSessions,
            ]) {
                await collapse(await view.getContent().getSection(item));
            }
            await loadCreateComponentButton();
        });

        it('Shows default actions when no component exists', function test() {
            if (!button) {
                expect.fail('No Create Component button found');
            }
        });

        it('Create component from git URL', async function test() {
            this.timeout(25_000);

            await clickCreateComponent();

            const createCompView = await initializeEditor();
            await createCompView.createComponentFromGit();

            const gitPage = new GitProjectPage();
            await gitPage.initializeEditor();
            await gitPage.insertGitLink('https://github.com/odo-devfiles/nodejs-ex');
            await gitPage.clickNextButton();
            await new Promise((res) => {
                setTimeout(res, 1_500);
            });
            await gitPage.clickContinueButton();

            await createComponent(createCompView);

            componentName = 'node-js-runtime';
            expect(await section.findItem(componentName)).to.be.not.undefined;

            dlt = false;
        });

        it('Create component from local folder', async function test() {
            this.timeout(25_000);
            fs.rmSync(pth.join(path, componentName, 'devfile.yaml'), { force: true });
            await refreshView();
            await loadCreateComponentButton();
            await clickCreateComponent();

            const createCompView = await initializeEditor();
            await createCompView.createComponentFromLocalCodebase();

            const localCodeBasePage = new LocalCodeBasePage();
            await localCodeBasePage.initializeEditor();
            await localCodeBasePage.insertComponentName(componentName);
            await localCodeBasePage.clickSelectFolderButton();

            const input = await InputBox.create();
            await input.setText(pth.join(path, componentName));
            await input.confirm();

            await localCodeBasePage.clickNextButton();
            await new Promise((res) => {
                setTimeout(res, 500);
            });
            await localCodeBasePage.clickCreateComponent();
            await new Promise((res) => {
                setTimeout(res, 6_000);
            });

            expect(await section.findItem(componentName)).to.be.not.undefined;
            dlt = true;
        });

        it('Create component from template project', async function test() {
            this.timeout(25_000);

            //Click on create component
            await clickCreateComponent();

            //Initialize create component editor and select create from template
            const createCompView = await initializeEditor();
            await createCompView.createComponentFromTemplate();

            //Initialize devfile editor and select stack
            const devfileView = new RegistryWebViewEditor(createCompView.editorName);
            await devfileView.initializeEditor();
            await devfileView.selectRegistryStack('Node.js Runtime');
            await new Promise((res) => {
                setTimeout(res, 500);
            });

            //Initialize stack window and click Use Devfile
            const devFileWindow = new RegistryWebViewDevfileWindow(createCompView.editorName);
            await devFileWindow.initializeEditor();
            await devFileWindow.useDevfile();

            //Initialize next page, fill out path and select create component
            await createComponent(createCompView);

            //check if component is in component view
            componentName = 'nodejs-starter';
            expect(await section.findItem(componentName)).to.be.not.undefined;
        });

        //Delete the component using file system
        afterEach(async function context() {
            this.timeout(30_000);
            if (componentName && dlt) {
                fs.rmSync(pth.join(path, componentName), { recursive: true, force: true });
                componentName = undefined;
                await refreshView();
                await loadCreateComponentButton();
            }
            await new EditorView().closeAllEditors();
            const notificationCenter = await new Workbench().openNotificationsCenter();
            const notifications = await notificationCenter.getNotifications(NotificationType.Any);
            if (notifications.length > 0) {
                await notificationCenter.close();
            }
        });

        after(async function context() {
            let prompt = await new Workbench().openCommandPrompt();
            await prompt.setText('>Workspaces: Remove Folder From Workspace...');
            await prompt.confirm();
            await prompt.setText('node-js-runtime');
            await prompt.confirm();
            await new Promise((res) => {
                setTimeout(res, 2_500);
            });
            prompt = await new Workbench().openCommandPrompt();
            await prompt.setText('>Workspaces: Remove Folder From Workspace...');
            await prompt.confirm();
            await prompt.setText('nodejs-starter');
            await prompt.confirm();
        });

        async function createComponent(createCompView: CreateComponentWebView): Promise<void> {
            const page = new SetNameAndFolderPage(createCompView.editorName);
            await page.initializeEditor();
            await page.clearProjectFolderPath();
            await page.insertProjectFolderPath(path);
            await page.clickCreateComponentButton();
            await new Promise((res) => {
                setTimeout(res, 6_000);
            });
        }

        async function initializeEditor(): Promise<CreateComponentWebView> {
            const createCompView = new CreateComponentWebView();
            await createCompView.initializeEditor();
            return createCompView;
        }

        async function refreshView() {
            await section.collapse();
            await section.expand();
            const refresh = await section.getAction('Refresh Components View');
            await refresh.click();
            await new Promise((res) => {
                setTimeout(res, 1_000);
            });
        }

        async function clickCreateComponent() {
            await button.click();
            await new Promise((res) => {
                setTimeout(res, 3_000);
            });
        }

        async function loadCreateComponentButton() {
            section = await view.getContent().getSection(VIEWS.components);
            const buttons = await (await section.findWelcomeContent()).getButtons();
            for (const btn of buttons) {
                if ((await btn.getTitle()) === BUTTONS.newComponent) {
                    button = btn;
                }
            }
        }
    });
}
