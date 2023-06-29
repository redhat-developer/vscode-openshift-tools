/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { expect } from 'chai';
import { ActivityBar, CustomTreeSection, SideBarView, ViewSection, WelcomeContentSection, Workbench } from 'vscode-extension-tester';
import { BUTTONS, VIEWS } from '../common/constants';

export function checkOpenshiftView() {
    describe('OpenShift View', function () {
        let view: SideBarView;

        before(async function context() {
            this.timeout(15_000);
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            await new Promise(res => setTimeout(res, 5000));
            await (await new Workbench().openNotificationsCenter()).clearAllNotifications();
        });

        it('Displays all view sections', async function () {
            this.timeout(15_000);
            const expected = [VIEWS.appExplorer, VIEWS.components, VIEWS.compRegistries, VIEWS.debugSessions];
            await view.wait(10_000);
            const content = view.getContent();
            expect((await content.getSections())).to.have.length(4);
            for (const sectionTitle of expected) {
                await content.wait(2_000);
                const section = await content.getSection(sectionTitle);
                await section.wait(2_000);
                await section.expand();
                const actualTitle = await section.getTitle();
                expect(actualTitle).to.eq(sectionTitle);
                await section.collapse();
            }
        });

        describe('Application Explorer', function () {
            let explorer: ViewSection;
            let welcome: WelcomeContentSection;

            before(async function () {
                this.timeout(60_000);
                explorer = await view.getContent().getSection(VIEWS.appExplorer);
                await explorer.wait(10_000);
                await explorer.expand();
                for (let i = 0; i < 60; i++) {
                    welcome = await explorer.findWelcomeContent();
                    if (welcome) {
                        break;
                    }
                    await new Promise((resolve) => { setTimeout(resolve, 1_000)});
                }

                for (const item of [VIEWS.components, VIEWS.compRegistries, VIEWS.debugSessions]) {
                    await (await view.getContent().getSection(item)).collapse();
                }
            });

            it('shows welcome content when not logged in', async function () {
                expect(welcome).not.undefined;
                const description = (await welcome.getTextSections()).join('');
                expect(description).not.empty;
            });

            it('shows buttons for basic actions when logged out', async function () {
                const btns = await welcome.getButtons();
                const titles = await Promise.all(btns.map(async btn => {
                    await btn.wait(2_000);
                    return btn.getTitle();
                }));
                const expected = [BUTTONS.login, BUTTONS.kubeContext, BUTTONS.addCluster];

                for (const btn of expected) {
                    expect(titles).includes(btn);
                }
            });

            it('shows more actions on hover', async function () {
                const actions = await explorer.getActions();
                expect(actions).length.above(3);
            });
        });

        describe('Components', function () {
            let section: ViewSection;
            let welcome: WelcomeContentSection;

            before(async function () {
                section = await view.getContent().getSection(VIEWS.components);
                await section.expand();
                welcome = await section.findWelcomeContent();
            });

            it('shows welcome content when not logged in', async function () {
                expect(welcome).not.undefined;
                expect((await welcome.getTextSections()).join('')).not.empty;
            });

            it('shows a button to create a new component', async function () {
                const btns = await welcome.getButtons();
                const titles = await Promise.all(btns.map(async item => await item.getTitle()));

                expect(titles).includes(BUTTONS.newComponent);
            });
        });

        describe('Devfile Registries', function () {
            let registries: CustomTreeSection;

            before(async function () {
                registries = await view.getContent().getSection(VIEWS.compRegistries) as CustomTreeSection;
                await registries.expand();
            });

            it('shows the default devfile registry', async function () {
                this.timeout(10000);
                await new Promise((res) => { setTimeout(res, 6000); });
                const registry = await registries.findItem(VIEWS.devFileRegistry);
                expect(registry).not.undefined;
            });
        });
    });
}
