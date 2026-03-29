/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { ActivityBar, ExtensionsViewItem, SideBarView } from 'vscode-extension-tester';
import * as pjson from '../../../package.json';
import { VIEWS } from '../common/constants';

export function checkExtension() {
    describe('Extensions view check', () => {

        beforeEach(async function () {
            this.timeout(15000);

            const view = await new ActivityBar().getViewControl(VIEWS.extensions);
            await view.openView();

            await new Promise(res => setTimeout(res, 500));
        });

        it('Openshift Toolkit is installed', async function () {
            this.timeout(30000);

            const item = await getItem();
            expect(item).not.undefined;
        });

        it('Openshift toolkit has the correct attributes', async function () {
            this.timeout(30000);

            const item = await getItem();

            const version = await item.getVersion();
            const author = await item.getAuthor();
            const desc = await item.getDescription();

            expect(version).equals(pjson.version);
            expect(author).equals(pjson.author);
            expect(desc).equals(pjson.description);
        });

        async function getItem(): Promise<ExtensionsViewItem> {
            const section = await new SideBarView().getContent().getSection(VIEWS.installed);
            return await section.findItem(`@installed ${pjson.displayName}`) as ExtensionsViewItem;
        }
    });
}