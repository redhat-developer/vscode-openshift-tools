/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    BottomBarPanel,
    EditorView,
    InputBox,
    Notification,
    NotificationType,
    ViewItem,
    ViewSection,
    VSBrowser,
    WebDriver,
    WelcomeContentSection,
    Workbench
} from 'vscode-extension-tester';

export async function waitForInputUpdate(
    input: InputBox,
    originalText: string,
    timeout = 5000,
): Promise<string> {
    return input.getDriver().wait(async () => {
        const text = await input.getMessage();
        if (text !== originalText) {
            if (text === '') {
                return ' ';
            }
            return text;
        }
    }, timeout);
}

export async function notificationExists(
    message: string,
    driver: WebDriver,
    timeout = 10000,
): Promise<Notification> {
    const center = await new Workbench().openNotificationsCenter();
    return driver.wait(async () => {
        try {
            const notifications = await center.getNotifications(NotificationType.Any);
            for (const item of notifications) {
                if ((await item.getMessage()) === message) {
                    return item;
                }
            }
        } catch {
            // workaround for reloadin notifications
        }
    }, timeout);
}

export async function notificationDoesNotExist(
    message: string,
    driver: WebDriver,
    timeout = 10_000,
): Promise<boolean> {
    const center = await new Workbench().openNotificationsCenter();
    return driver.wait(async () => {
        try {
            const notifications = await center.getNotifications(NotificationType.Any);
            const notificationText = [];
            notifications.forEach(
                (item) => async () => notificationText.push(await item.getMessage()),
            );

            if (!notificationText.includes(message)) {
                await center.close();
                return true;
            }
        } catch {
            // tbd
        }
    }, timeout);
}

export async function itemExists(
    title: string,
    view: ViewSection,
    timeout = 10000,
): Promise<ViewItem> {
    return view.getDriver().wait(
        async () => {
            try {
                const item = await view.findItem(title);
                if (item) {
                    return item;
                }
            } catch {
                return null;
            }
        },
        timeout,
        `Item '${title}' not found.`,
    );
}

export async function stabilizeComponentsView(getSection: () => Promise<ViewSection>, timeout = 20000): Promise<ViewSection> {
    const result = await VSBrowser.instance.driver.wait(async () => {
        try {
            let section = await getSection();

            await section.expand();
            await new Promise(res => setTimeout(res, 300));

            section = await getSection();

            // ---- try tree mode ----
            try {
                const items = await section.getVisibleItems();
                await Promise.all(items.map(i => i.getText()));
                return section;
            } catch {
                // ---- fallback: welcome content mode ----
                try {
                    const welcome = await section.findWelcomeContent();
                    const buttons = await welcome.getButtons();
                    if (buttons) {
                        return section;
                    }
                } catch {
                    return false;
                }
            }

            return false;

        } catch {
            return false;
        }
    }, timeout, 'Components view did not stabilize');

    return result as ViewSection;
}

export async function findItemFuzzy(section: ViewSection, label: string): Promise<ViewItem | undefined> {
    const items = await section.getVisibleItems();
    for (const item of items) {
        try {
            const text = await item.getText();
            if (text.includes(label)) {
                return item;
            }
        } catch {
            // ignore
        }
    }

    return undefined;
}

export async function waitForItem(getSection: () => Promise<ViewSection>, label: string, strict: boolean = true, timeout = 15000) {
    return VSBrowser.instance.driver.wait(async () => {
        try {
            const section = await getSection();
            const item = strict ? await section.findItem(label) : await findItemFuzzy(section, label);
            return item ?? false;
        } catch {
            return false;
        }
    }, timeout, `Item "${label}" not found within ${timeout}ms`) as Promise<ViewItem>;
}

export async function waitForItemStable(getSection: () => Promise<ViewSection>, label: string, strict: boolean = true, timeout = 15000) {
    await stabilizeComponentsView(getSection);
    return waitForItem(getSection, label, strict, timeout);
}


export async function waitForItemToDisappear(getSection: () => Promise<ViewSection>, label: string, timeout = 15000): Promise<boolean> {
    return VSBrowser.instance.driver.wait(async () => {
        try {
            const section = await getSection();
            const item = await section.findItem(label);
            return !item;
        } catch {
            return true;
        }
    }, timeout, `Item "${label}" still exists after ${timeout}ms`);
}

export async function waitForItemToDisappearStable(getSection: () => Promise<ViewSection>, label: string, timeout = 15000): Promise<boolean> {
    await stabilizeComponentsView(getSection);
    return waitForItemToDisappear(getSection, label, timeout);
}

export async function withStableItem(getSection: () => Promise<ViewSection>, label: string, action: (item: ViewItem) => Promise<void>, timeout = 10_000) {
    await stabilizeComponentsView(getSection);
    return VSBrowser.instance.driver.wait(async () => {
        try {
            const section = await getSection();
            const item = await section.findItem(label);
            if (!item) return false;
            await action(item);
            return true;
        } catch {
            return false;
        }
    }, timeout, `Action on "${label}" could not be performed`);
}

export async function itemDoesNotExist(
    title: string,
    view: ViewSection,
    timeout = 10000,
): Promise<boolean> {
    return view.getDriver().wait(
        async () => {
            try {
                const item = await view.findItem(title);
                if (!item) {
                    return true;
                }
            } catch {
                return true;
            }
        },
        timeout,
        `Item ${title} should not exists, but does.`,
    );
}

export async function itemHasText(
    title: string,
    text: string,
    view: ViewSection,
    timeout = 10_000,
): Promise<ViewItem> {
    return view.getDriver().wait(async () => {
        try {
            const item = await view.findItem(title);
            if (item) {
                const itemText = await item.getText();
                if (itemText.includes(text)) {
                    return item;
                }
            }
        } catch {
            return null;
        }
    }, timeout);
}

export async function waitForInputProgress(input: InputBox, shouldExist: boolean, timeout = 5000) {
    return input.getDriver().wait(async () => {
        const hasProgress = await input.hasProgress();
        if (hasProgress === shouldExist) {
            return true;
        }
    }, timeout);
}

export async function terminalHasText(text: string, timeout = 60000, period = 5000) {
    const terminal = await new BottomBarPanel().openTerminalView();
    await terminal.getDriver().wait(async () => {
        const currentText = await terminal.getText();
        if (currentText.includes(text)) {
            return true;
        }
        await new Promise((res) => setTimeout(res, period));
    }, timeout);
}

export async function welcomeContentButtonsAreLoaded(
    welcomeContentSection: WelcomeContentSection,
    timeout = 60_000,
) {
    return welcomeContentSection.getDriver().wait(async () => {
        const buttons = await welcomeContentSection.getButtons();
        if (buttons.length > 0) {
            return buttons;
        }
    }, timeout);
}

export async function welcomeContentIsLoaded(viewSection: ViewSection, timeout = 60_000) {
    return viewSection.getDriver().wait(async () => {
        const welcomeContent = await viewSection.findWelcomeContent();
        if (welcomeContent) {
            return welcomeContent;
        }
    }, timeout);
}

export async function webViewIsOpened(name: string, driver: WebDriver, timeout = 10_000) {
    return driver.wait(async () => {
        try {
            const editor = new EditorView();
            await editor.openEditor(name);
            return true;
        } catch {
            return null;
        }
    }, timeout);
}

export async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const callSiteStack = new Error(`Step: ${name}`).stack;
    try {
        return await fn();
    } catch (err) {
        const error = err as Error;
        error.message = `Step failed: ${name}\n${error.message}`;
        if (error.stack && callSiteStack) {
            error.stack =
                `${error.stack}\n\n--- Step call site ---\n${callSiteStack}`;
        }
        throw error;
    }
}

export async function debugClick(element, name: string) {
    try {
        await element.click();
    } catch (e) {
        /* eslint-disable no-console */
        error(`Failed to click: ${name}`);
        error(await element.getAttribute('outerHTML'));
        /* eslint-enable no-console */
        throw e;
    }
}

/* eslint-disable no-console */
export async function listItems(getSection: () => Promise<ViewSection>, title = undefined): Promise<void> {
    const t = title ? `[${title}]: ` : '';
    log(`${t}Current components in view: >>>`);

    try {
        await VSBrowser.instance.driver.wait(async () => {
            try {
                const section = await getSection();

                // Expand the section
                await section.expand();

                // First try: list actual components
                try {
                    const items = await VSBrowser.instance.driver.wait(async () => {
                        try {
                            return await section.getVisibleItems();
                        } catch {
                            return null;
                        }
                    }, 10000);

                    if (items && items.length) {
                        const labels = [];
                        for (const item of items) {
                            try {
                                labels.push(await item.getText());
                            } catch {
                                labels.push('<error>');
                            }
                        }
                        log(`[${labels.join(', ')}]`);
                        return true;
                    }
                } catch {
                    // fallback to welcome content
                }

                // Second try: welcome content (empty section)
                try {
                    const welcome = await section.findWelcomeContent();
                    const buttons = await welcome.getButtons();
                    if (buttons && buttons.length) {
                        log('[<empty: welcome content>]');
                        return true;
                    }
                } catch {
                    // still nothing visible, retry
                }

                return false;

            } catch {
                return false;
            }
        }, 10000, 'Could not list items');

    } catch (err) {
        log('Error while getting the current components: ', err);
    } finally {
        log('<<<');
    }
}

export const log = console.log;
export const warn = console.warn;
export const error = console.error;
/* eslint-enable no-console */
