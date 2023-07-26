/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { ActivityBar, ExtensionsViewItem, ExtensionsViewSection, SideBarView } from 'vscode-extension-tester';
import * as pjson from '../../../package.json';
import { VIEWS } from '../common/constants';

export function checkExtension() {
    describe('Extensions view check', () => {
        let extView: ExtensionsViewSection;
        let item: ExtensionsViewItem;

        before(async function () {
            this.timeout(15_000);
            const btn = await new ActivityBar().getViewControl(VIEWS.extensions);
            await btn.openView();
            extView = await new SideBarView().getContent().getSection(VIEWS.installed) as ExtensionsViewSection;
            item = await extView.findItem(`@installed ${pjson.displayName}`);
        });

        it('Openshift Toolkit is installed', () => {
            expect(item).not.undefined;
        });

        it('Openshift toolkit has the correct attributes', async function() {
            this.timeout(10_000)
            let version: string;
            let author: string;
            let desc: string;
            try{
                version = await item.getVersion();
                author = await item.getAuthor();
                desc = await item.getDescription();
            } catch {
                await new Promise(res => setTimeout(res, 5_000));
                version = await item.getVersion();
                author = await item.getAuthor();
                desc = await item.getDescription();
            }

            expect(version).equals(pjson.version);
            expect(author).equals(pjson.author);
            expect(desc).equals(pjson.description);
        });
    });
}
