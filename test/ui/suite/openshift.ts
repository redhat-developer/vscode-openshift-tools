/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { expect } from 'chai';
import { ActivityBar, CustomTreeSection, SideBarView, ViewSection, WelcomeContentSection, Workbench } from 'vscode-extension-tester';
import { BUTTONS, VIEWS } from '../common/constants';

export function checkOpenshiftView() {
    describe('OpenShift View', () => {
        let view: SideBarView;

        before(async function context() {
            this.timeout(10000);
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            await new Promise(res => setTimeout(res, 5000));
            await (await new Workbench().openNotificationsCenter()).clearAllNotifications();
        });

        it('Displays all view sections', async () => {
            const expected = [VIEWS.appExplorer, VIEWS.components, VIEWS.compRegistries, VIEWS.debugSessions];
            const content = view.getContent();
            for (const sectionTitle of expected) {
                const section = await content.getSection(sectionTitle);
                expect(await section.getTitle()).to.eq(sectionTitle);
                await section.collapse();
            }
        });

        describe('Application Explorer', () => {
            let explorer: ViewSection;
            let welcome: WelcomeContentSection;

            before(async () => {
                explorer = await view.getContent().getSection(VIEWS.appExplorer);
                await explorer.expand();
                welcome = await explorer.findWelcomeContent();

                for (const item of [VIEWS.components, VIEWS.compRegistries, VIEWS.debugSessions]) {
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
                section = await view.getContent().getSection(VIEWS.components);
                await section.expand();
                welcome = await section.findWelcomeContent();
            });

            it('shows welcome content when not logged in', async () => {
                expect(welcome).not.undefined;
                expect((await welcome.getTextSections()).join('')).not.empty;
            });

            it('shows a button to create a new component', async () => {
                const btns = await welcome.getButtons();
                const titles = await Promise.all(btns.map(async item => await item.getTitle()));

                expect(titles).includes(BUTTONS.newComponent);
            });
        });

        describe('Component Registries', () => {
            let types: CustomTreeSection;

            before(async () => {
                types = await view.getContent().getSection(VIEWS.compRegistries) as CustomTreeSection;
                await types.expand();
            });

            it('shows the default devfile registry', async function test() {
                this.timeout(10000);
                await new Promise((res) => { setTimeout(res, 6000); });
                const registry = await types.findItem(VIEWS.devFileRegistry);
                expect(registry).not.undefined;
            });
        });
    });
}
