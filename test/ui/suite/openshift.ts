/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { expect } from 'chai';
import { ActivityBar, CustomTreeSection, SideBarView, ViewSection, WelcomeContentSection, Workbench } from 'vscode-extension-tester';
import { BUTTONS, VIEWS } from '../common/constants';
import { collapse } from '../common/overdrives';
import { welcomeContentButtonsAreLoaded, welcomeContentIsLoaded } from '../common/conditions';

export function checkOpenshiftView() {
    describe('OpenShift View', function() {
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

        describe('Application Explorer', function () {
            let explorer: ViewSection;
            let welcome: WelcomeContentSection;

            before(async function() {
                explorer = await view.getContent().getSection(VIEWS.appExplorer);
                await explorer.expand();
                welcome = await welcomeContentIsLoaded(explorer);

                for (const item of [VIEWS.components, VIEWS.compRegistries, VIEWS.serverlessFunctions, VIEWS.debugSessions]) {
                    await (await view.getContent().getSection(item)).collapse();
                }
            });

            it('shows welcome content when not logged in', async function() {
                await welcomeContentButtonsAreLoaded(welcome);
                expect(welcome).not.undefined;
                const description = (await welcome.getTextSections()).join('');
                expect(description).not.empty;
            });

            it('shows buttons for basic actions when logged out', async function() {
                const btns = await welcome.getButtons();
                await Promise.all(btns.map(async btn => btn.wait(5_000)));
                const titles = await Promise.all(btns.map(async btn => btn.getTitle()));
                const expected = [BUTTONS.login, BUTTONS.kubeContext, BUTTONS.addCluster];

                for (const btn of expected) {
                    expect(titles).includes(btn);
                }
            });

            it('shows more actions on hover', async function() {
                const actions = await explorer.getActions();
                expect(actions).length.above(3);
            });
        });

        //Unstable and replaced by createComponent tests
        describe.skip('Components', function() {
            let section: ViewSection;
            let welcome: WelcomeContentSection;

            before(async () => {
                this.timeout(15_000)
                section = await view.getContent().getSection(VIEWS.appExplorer);
                await collapse(section);
                section = await view.getContent().getSection(VIEWS.components);
                await section.expand();
                welcome = await section.findWelcomeContent();
            });

            it('shows welcome content when not logged in', async function() {
                this.timeout(15_000)
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

        describe('Devfile Registries', function() {
            let registries: CustomTreeSection;

            before(async function() {
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
