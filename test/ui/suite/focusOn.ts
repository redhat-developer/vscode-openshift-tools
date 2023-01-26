/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { ActivityBar, SideBarView, VSBrowser } from 'vscode-extension-tester'
import { activateCommand } from '../common/command-activator';
import { VIEWS } from '../common/constants';

export function checkFocusOnCommands() {
    describe('Focus on Commands', () => {
        let view: SideBarView;
        const sections = [VIEWS.appExplorer, VIEWS.components, VIEWS.compRegistries, VIEWS.debugSessions];

        before('Open OpenShift View', async function(){
            this.timeout(10000);
            view = await (await new ActivityBar().getViewControl('OpenShift')).openView();
            VSBrowser.instance.driver.wait(async () => !(await view.getContent().hasProgress()),
            5000,
            'Progress bar has not been hidden within the timeout'
            );
            for(const section of sections){
                await (await view.getContent().getSection(section)).collapse();
            }
        })

        sections.forEach(section =>
            it(`Focus on ${section} view`, async function() {
                this.timeout(30000);
                await activateCommand(`>OpenShift: Focus on ${section} view`);
                expect(await (await view.getContent().getSection(section)).isExpanded()).to.be.true;
            })
        )
    });
