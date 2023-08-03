/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { expect } from 'chai';
import { ActivityBar, By, CustomTreeSection, SideBarView, ViewSection, WelcomeContentSection, Workbench, waitForAttributeValue } from 'vscode-extension-tester';
import { BUTTONS, VIEWS } from '../common/constants';

async function collapse(section: ViewSection){
    try {
        await section.collapse();
    } catch {
        if (await section.isExpanded()) {
            const mainPanel = await section.findElement(By.className('pane-header'));
            const arrowPanel = await section.findElement(By.className('codicon'));
            await arrowPanel.click();
            await section.getDriver().wait(waitForAttributeValue(mainPanel, 'aria-expanded', 'false'), 2_000);
        }
    }
}

export function checkOpenshiftView() {
    describe('OpenShift View', () => {
        let view: SideBarView;

        before(async function context() {
            this.timeout(10_000);
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            await new Promise(res => setTimeout(res, 5000));
            await (await new Workbench().openNotificationsCenter()).clearAllNotifications();
        });

        it('Displays all view sections', async function () {
            this.timeout(10_000);
            const expected = [VIEWS.appExplorer, VIEWS.components, VIEWS.compRegistries, VIEWS.serverlessFunctions, VIEWS.debugSessions];
            const content = view.getContent();
            for (const sectionTitle of expected) {
                const section = await content.getSection(sectionTitle);
                expect(await section.getTitle()).to.eq(sectionTitle);
                await collapse(section);
            }
        });

        describe('Application Explorer', () => {
            let explorer: ViewSection;
            let welcome: WelcomeContentSection;

            before(async () => {
                explorer = await view.getContent().getSection(VIEWS.appExplorer);
                await explorer.expand();
                welcome = await explorer.findWelcomeContent();

                for (const item of [VIEWS.components, VIEWS.compRegistries, VIEWS.serverlessFunctions, VIEWS.debugSessions]) {
                    await (await view.getContent().getSection(item)).collapse();
                }
            });

            it('shows welcome content when not logged in', async () => {
                expect(welcome).not.undefined;
                const description = (await welcome.getTextSections()).join('');
                expect(description).not.empty;
            });

            it('shows buttons for basic actions when logged out', async () => {
                const btns = await welcome.getButtons();
                const titles = await Promise.all(btns.map(async btn => btn.getTitle()));
                const expected = [BUTTONS.login, BUTTONS.kubeContext, BUTTONS.addCluster];

                for (const btn of expected) {
                    expect(titles).includes(btn);
                }
            });

            it('shows more actions on hover', async () => {
                const actions = await explorer.getActions();
                expect(actions).length.above(3);
            });
        });

        describe('Components', () => {
            let section: ViewSection;
            let welcome: WelcomeContentSection;

            before(async () => {
                section = await view.getContent().getSection(VIEWS.appExplorer);
                await collapse(section);
                section = await view.getContent().getSection(VIEWS.components);
                await section.expand();
                welcome = await section.findWelcomeContent();
            });

            it('shows welcome content when not logged in', async () => {
                expect(welcome).not.undefined;
                expect((await welcome.getTextSections()).join('')).not.empty;
            });

            it('shows a button to create a new component', async () => {
                let btns = await welcome.getButtons();
                let titles = await Promise.all(btns.map(async item => await item.getTitle()));
                //Perform second search if the first one did not succeed
                if(!titles.includes(BUTTONS.newComponent)){
                    btns = await welcome.getButtons();
                    titles = await Promise.all(btns.map(async item => await item.getTitle()));
                }

                expect(titles).includes(BUTTONS.newComponent);
            });
        });

        describe('Devfile Registries', () => {
            let registries: CustomTreeSection;

            before(async () => {
                registries = await view.getContent().getSection(VIEWS.compRegistries);
                await registries.expand();
            });

            it('shows the default devfile registry', async function test() {
                this.timeout(10_000);
                await new Promise((res) => { setTimeout(res, 6_000); });
                const registry = await registries.findItem(VIEWS.devFileRegistry);
                expect(registry).not.undefined;
            });
        });
    });
}
