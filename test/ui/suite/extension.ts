/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { ActivityBar, ExtensionsViewItem, SideBarView } from 'vscode-extension-tester';
import * as pjson from '../../../package.json';
import { waitForItem } from '../common/conditions';
import { VIEWS } from '../common/constants';

export function checkExtension() {
    describe('Extensions view check', () => {

        async function withStaleRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
            for (let attempt = 1; ; attempt++) {
                try {
                    return await fn();
                } catch (e) {
                    if ((e as Error)?.name !== 'StaleElementReferenceError' || attempt === attempts) {
                        throw e;
                    }
                }
                await new Promise((res) => setTimeout(res, 500));
            }
        }

        beforeEach(async function () {
            this.timeout(15000);

            const view = await new ActivityBar().getViewControl(VIEWS.extensions);
            await view.openView();

            await new Promise(res => setTimeout(res, 500));
        });

        it('Openshift Toolkit is installed', async function () {
            this.timeout(30000);

            const item = await withStaleRetry(() => getItem());
            expect(item).not.undefined;
        });

        it('Openshift toolkit has the correct attributes', async function () {
            this.timeout(30000);

            const { version, author, desc } = await withStaleRetry(async () => {
                const item = await getItem();
                expect(item).not.undefined;
                return {
                    version: await item.getVersion(),
                    author: await item.getAuthor(),
                    desc: await item.getDescription(),
                };
            });

            expect(version).equals(pjson.version);
            expect(desc).equals(pjson.description);

            // getAuthor() returns either author name or publisher ID depending on VS Code version.
            // Accept both to maintain compatibility across versions.
            expect(author).oneOf([pjson.author, pjson.publisher]);

        });

        async function getItem(): Promise<ExtensionsViewItem> {
            const getSection = async () => new SideBarView().getContent().getSection(VIEWS.installed);
            return await waitForItem(getSection, `@installed ${pjson.displayName}`) as ExtensionsViewItem;
        }
    });
}