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
    VSBrowser,
    Workbench
} from 'vscode-extension-tester';
import { notificationExists, stabilizeComponentsView, step, waitForItemStable, waitForItemToDisappearStable, warn, withStableItem } from '../common/conditions';
import { BUTTONS, INPUTS, MENUS, NOTIFICATIONS, VIEWS } from '../common/constants';
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
        });

        it('Shows default actions when no component exists', async function test() {
            await VSBrowser.instance.driver.wait(async () => {
                try {
                    await stabilizeComponentsView(getSection);

                    const section = await getSection();
                    const welcome = await section.findWelcomeContent();
                    const buttons = await welcome.getButtons();

                    for (const btn of buttons) {
                        if ((await btn.getTitle()) === BUTTONS.newComponent) {
                            return true;
                        }
                    }

                    return false;
                } catch {
                    return false;
                }
            }, 10_000, 'No Create Component button found');
        });

        it('Create component from git URL', async function test() {
            this.timeout(25_000);

            await clickCreateComponentStable();

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

            const item = await waitForItemStable(getSection, componentName);
            expect(item).to.be.not.undefined;

            dlt = false;
        });

        it('Create component from local folder', async function test() {
            this.timeout(25_000);

            await step(`Delete "${componentName}" component configuration` , async () => {
                await withStableItem(getSection, componentName, async (item) => {
                    const menu = await item.openContextMenu();
                    await menu.select(MENUS.deleteConfiguration);
                });
            });

            const notification = await notificationExists(
                NOTIFICATIONS.deleteConfig(pth.join(path, componentName)),
                VSBrowser.instance.driver,
            );
            await notification.takeAction(INPUTS.deleteConfiguration);

            const notificationCenter = await new Workbench().openNotificationsCenter();
            const notifications = await notificationCenter.getNotifications(NotificationType.Any);
            if (notifications.length > 0) {
                await notificationCenter.close();
            }

            await refreshView();

            await step('Click Create Component', async () => {
                await clickCreateComponentStable();
            });

            const createCompView = await initializeEditor();
            await step('Click Create from Local Codebase', async () => {
                await createCompView.createComponentFromLocalCodebase();
            });

            const localCodeBasePage = new LocalCodeBasePage();
            await localCodeBasePage.initializeEditor();

            await step('Insert component name', async () => {
                await localCodeBasePage.insertComponentName(componentName);
            });

            await step('Click Select Folder button', async () => {
                await localCodeBasePage.clickSelectFolderButton();
            });

            await step('Input component path', async () => {
                const input = await InputBox.create();
                await input.setText(pth.join(path, componentName));
                await input.confirm();
                // critical: wait until InputBox is gone
                await VSBrowser.instance.driver.wait(async () => {
                    try {
                        await InputBox.create();
                        return false;
                    } catch {
                        return true;
                    }
                }, 10000);
            });

            await step('Click Next button', async () => {
                await localCodeBasePage.clickNextButton();
                await new Promise((res) => {
                    setTimeout(res, 500);
                });
            });

            await step('Click Create Component button', async () => {
                await localCodeBasePage.clickCreateComponent();
            });

            const item = await waitForItemStable(getSection, componentName);
            expect(item).to.be.not.undefined;

            dlt = true;
        });

        it('Create component from template project', async function test() {
            this.timeout(25_000);

            //Click on create component
            await clickCreateComponentStable();

            //Initialize create component editor and select create from template
            const createCompView = await initializeEditor();
            await createCompView.createComponentFromTemplate();

            //Initialize devfile editor and select stack
            const devfileView = new RegistryWebViewEditor(createCompView.editorName);
            await devfileView.initializeEditor();
            const stackName = 'Node.js Runtime';
            const stackFound = await devfileView.selectRegistryStack(stackName);
            expect(stackFound, `Stack not found: "${stackName}"`).to.be.true;

            await new Promise((res) => {
                setTimeout(res, 1_500);
            });

            //Initialize stack window and click Use Devfile
            const devFileWindow = new RegistryWebViewDevfileWindow(createCompView.editorName);
            await devFileWindow.initializeEditor();
            await VSBrowser.instance.driver.wait(async () => {
                try {
                    return await devFileWindow.hasUseDevfileButton();
                } catch {
                    return false;
                }
            }, 10000, '"Use Devfile" button not found');

            await VSBrowser.instance.driver.wait(async () => {
                try {
                    await devFileWindow.useDevfile();
                    return true;
                } catch {
                    return false;
                }
            }, 10000, '"Use Devfile" button not clickable');

            //Initialize next page, fill out path and select create component
            await createComponent(createCompView);
            await refreshView();

            //check if component is in component view
            componentName = 'nodejs-starter';
            const item = await waitForItemStable(getSection, componentName);
            expect(item).to.be.not.undefined;

            dlt = false;
        });

        //Delete the component using file system
        afterEach(async function context() {
            this.timeout(30_000);

            try {
                if (componentName && dlt) {
                    await deleteComponentIfExists(componentName);
                    componentName = undefined;
                    dlt = false;
                    await refreshView();
                } else {
                    await stabilizeComponentsView(getSection);
                }
            } catch (err) {
                warn('Cleanup source code folder failed (ignored):', err);
            }

            // Close all editors
            try { await new EditorView().closeAllEditors(); } catch { /* Ignore */ }

            // Close any remaining notifications
            try {
                const notificationCenter = await new Workbench().openNotificationsCenter();
                const notifications = await notificationCenter.getNotifications(NotificationType.Any);
                if (notifications.length > 0) {
                    await notificationCenter.close();
                }
            } catch { /* Ignore */ }
        });

        after(async function context() {
            this.timeout(15_000);
            try {
                const prompt = await new Workbench().openCommandPrompt();
                await VSBrowser.instance.driver.wait(async () => {
                    return await prompt.isDisplayed();
                }, 5000);

                await prompt.setText('>Workspaces: Remove Folder From Workspace...');
                await prompt.confirm();
                await prompt.setText('node-js-runtime');
                await prompt.confirm();

                if (await prompt.isDisplayed()) {
                    await prompt.cancel();
                }
            } catch (err) {
                warn('Cleanup remove folder failed (ignored):', err);
            }
        });

        async function deleteComponentIfExists(componentName: string) {
            await withStableItem(getSection, componentName, async (item) => {
                const menu = await item.openContextMenu();
                await menu.select(MENUS.deleteSourceCodeFolder);
            });

            const notification = await notificationExists(
                NOTIFICATIONS.deleteSourceCodeFolder(pth.join(path, componentName)),
                VSBrowser.instance.driver
            );
            if (!notification) {
                throw new Error(`Delete notification for "${componentName}" did not appear`);
            }

            await notification.takeAction(INPUTS.deleteSourceFolder);

            const gone = await waitForItemToDisappearStable(getSection, componentName, 20_000);
            if (!gone) {
                throw new Error(`Component "${componentName}" still exists after deletion`);
            }

            return true;
        }

        async function createComponent(createCompView: CreateComponentWebView): Promise<void> {
            const page = new SetNameAndFolderPage(createCompView.editorName);
            await page.initializeEditor();
            await page.clearProjectFolderPath();
            await page.insertProjectFolderPath(path);
            await page.clickCreateComponentButton();
        }

        async function initializeEditor(): Promise<CreateComponentWebView> {
            const createCompView = new CreateComponentWebView();

            await VSBrowser.instance.driver.wait(async () => {
                try {
                    await createCompView.initializeEditor();
                    return true;
                } catch {
                    return false;
                }
            }, 10000, 'Create Component webview not initialized');

            return createCompView;
        }

        async function refreshView() {
            await VSBrowser.instance.driver.wait(async () => {
                try {
                    const section = await getSection();

                    await section.collapse();
                    await section.expand();

                    const action = await section.getAction('Refresh Components View');
                    if (!action) return false;

                    await action.safeClick();
                    return true;

                } catch {
                    return false;
                }
            }, 15_000, 'Failed to refresh components view');

            await stabilizeComponentsView(getSection);
        }

        async function clickCreateComponentStable() {
            const MAX_ATTEMPTS = 5;

            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {

                await stabilizeComponentsView(getSection);

                let clicked = false;
                try {
                    const section = await getSection();
                    try {
                        const welcome = await section.findWelcomeContent();
                        const buttons = await welcome.getButtons();

                        for (const btn of buttons) {
                            const title = await btn.getTitle();
                            if (title === BUTTONS.newComponent) {
                                await btn.safeClick();
                                clicked = true;
                                break;
                            }
                        }
                    } catch {
                        // ignore and fallback
                    }

                    if (!clicked) {
                        const action = await section.getAction(BUTTONS.newComponent);
                        await action.safeClick();
                        clicked = true;
                    }
                } catch {
                    clicked = false;
                }

                if (!clicked) {
                    continue; // retry full cycle
                }

                const opened = await VSBrowser.instance.driver.wait(async () => {
                    try {
                        const editor = new EditorView();
                        const titles = await editor.getOpenEditorTitles();
                        return titles.some(t => t.includes('Create Component'));
                    } catch {
                        return false;
                    }
                }, 5000).catch(() => false);

                if (opened) {
                    return; // success
                }
            }

            throw new Error('Failed to open Create Component editor after multiple attempts');
        }

        async function getSection(): Promise<ViewSection> {
            return await view.getContent().getSection(VIEWS.components);
        }
    });
}
