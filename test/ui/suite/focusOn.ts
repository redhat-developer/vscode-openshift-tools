/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { ActivityBar, SideBarView, VSBrowser, WebDriver } from 'vscode-extension-tester'
import { activateCommand } from '../common/command-activator';
import { VIEWS } from '../common/constants';

export function checkFocusOnCommands() {
    describe('Focus on Commands', () => {
        let view: SideBarView;
        let driver: WebDriver;
        const sections = [VIEWS.components, VIEWS.compRegistries, VIEWS.debugSessions, VIEWS.appExplorer];

        before('Open OpenShift View', async function(){
            this.timeout(10000);
            view = await (await new ActivityBar().getViewControl('OpenShift')).openView();
            await new Promise(res => setTimeout(res, 4000));
            driver = VSBrowser.instance.driver;
        })

        sections.forEach(viewSection =>
            it(`Focus on ${viewSection} view`, async function() {
                this.timeout(30000);
                await activateCommand(`>OpenShift: Focus on ${viewSection} view`);

                const section = await view.getContent().getSection(viewSection);
                const text = await section.getText();
                const expectedContent = text.slice(viewSection.length + 1);
                const actualContent = await driver.switchTo().activeElement().getText();

                expect(actualContent).to.equal(expectedContent);
            })
        )
    });
}