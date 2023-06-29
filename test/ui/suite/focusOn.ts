/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { ActivityBar, SideBarView } from 'vscode-extension-tester';
import { activateCommand } from '../common/command-activator';
import { VIEWS } from '../common/constants';

export function checkFocusOnCommands() {
    describe('Focus on Commands', function () {
        let view: SideBarView;
        const sections = [VIEWS.appExplorer, VIEWS.components, VIEWS.compRegistries, VIEWS.debugSessions];

        before('Open OpenShift View', async function() {
            this.timeout(15_000);
            const activityBar = await new ActivityBar().wait(5_000);
            const viewControl = await (await activityBar.getViewControl('OpenShift')).wait(5_000);
            view = await ((await viewControl.openView()).wait(5_000));
            const viewContent = await view.getContent().wait(2_000);
            await viewContent.getSections();
            for (const section of sections) {
                const viewSection = await (await viewContent.getSection(section)).wait(2_000);
                await viewSection.collapse();
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
}