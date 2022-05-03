/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { ActivityBar, CustomTreeSection, SideBarView, ViewSection, WebView, WelcomeContentSection } from 'vscode-extension-tester';
import { BUTTONS, VIEWS } from '../common/constants';

export function checkOpenshiftView() {
    describe('OpenShift View', () => {
        let view: SideBarView;

        before(async () => {
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            await new Promise(res => setTimeout(res, 5000));
        });

        it('Displays all view sections', async () => {
            const expected = [VIEWS.appExplorer, VIEWS.components, VIEWS.compTypes, VIEWS.watchSessions, VIEWS.debugSessions];
            const sections = await view.getContent().getSections();
            const titles = await Promise.all(sections.map(async item => item.getTitle()));

            for (const item of expected) {
                expect(titles).contains(item);
            }
        });

        describe('Application Explorer', () => {
            let explorer: ViewSection;
            let welcome: WelcomeContentSection;

            before(async () => {
                explorer = await view.getContent().getSection(VIEWS.appExplorer);
                welcome = await explorer.findWelcomeContent();

                for (const item of [VIEWS.components, VIEWS.compTypes, VIEWS.watchSessions, VIEWS.debugSessions]) {
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
                const titles = await Promise.all(btns.map(async item => item.getTitle()));

                expect(titles).includes(BUTTONS.newComponent);
            });
        });

        describe('Component Types', () => {
            let types: CustomTreeSection;

            before(async () => {
                types = await view.getContent().getSection(VIEWS.compTypes) as CustomTreeSection;
                await types.expand();
            });

            it('shows the default devfile registry', async () => {
                const registry = await types.findItem(VIEWS.devFileRegistry);
                expect(registry).not.undefined;
            });

            it('opens viewer for default devfile registry', async () =>{
              const registry = await types.findItem(VIEWS.devFileRegistry);
              const contextMenu = registry.openContextMenu();
              const item = await (await contextMenu).getItem('Open in Viewer');
              item.click();
              await new Promise((res) => { setTimeout(res, 500); });
              const regView = new WebView();
              await regView.switchToFrame();

              await new Promise((res) => { setTimeout(res, 5000); });
          });
        });
    });
}