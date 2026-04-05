/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { VSBrowser, ViewItem, ViewSection } from 'vscode-extension-tester';

export async function waitForItem(
    getSection: () => Promise<ViewSection>,
    label: string,
    timeout = 15000
) {
    return VSBrowser.instance.driver.wait(async () => {
        try {
            const section = await getSection();
            const item = await section.findItem(label);
            return item ?? false;
        } catch {
            return false;
        }
    }, timeout, `Item "${label}" not found within ${timeout}ms`) as Promise<ViewItem>;
}

export async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const stack = new Error().stack;

    try {
        return await fn();
    } catch (err) {
        const error = err as Error;
        error.message = `Step failed: ${name}\n${error.message}`;
        error.stack = stack;
        throw error;
    }
}

export async function debugClick(element, name: string) {
    try {
        await element.click();
    } catch (e) {
        /* eslint-disable no-console */
        console.error(`Failed to click: ${name}`);
        console.error(await element.getAttribute('outerHTML'));
        /* eslint-enable no-console */
        throw e;
    }
}