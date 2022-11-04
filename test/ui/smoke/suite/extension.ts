/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { ActivityBar, ExtensionsViewItem, ExtensionsViewSection, SideBarView } from 'vscode-extension-tester';
import * as pjson from '../../../../package.json';
import { VIEWS } from '../common/constants';

export function checkExtension() {
    describe('Extensions view check', () => {
        let extView: ExtensionsViewSection;
        let item: ExtensionsViewItem;

        before(async function () {
            this.timeout(15000);
            const btn = await new ActivityBar().getViewControl(VIEWS.extensions);
            await btn.openView();
            extView = await new SideBarView().getContent().getSection(VIEWS.installed) as ExtensionsViewSection;
            item = await extView.findItem(`@installed ${pjson.displayName}`);
        });

        it('Openshift toolkit is installed', () => {
            expect(item).not.undefined;
        });

        it('Openshift toolkit has the correct attributes', async () => {
            const version = await item.getVersion();
            const author = await item.getAuthor();
            const desc = await item.getDescription();

            expect(version).equals(pjson.version);
            expect(author).equals(pjson.author);
            expect(desc).equals(pjson.description);
        });
    });
}