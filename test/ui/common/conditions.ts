/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { BottomBarPanel, EditorView, InputBox, Notification, NotificationType, ViewItem, ViewSection, WebDriver, WelcomeContentSection, Workbench } from 'vscode-extension-tester';

export async function waitForInputUpdate(input: InputBox, originalText: string, timeout = 5000): Promise<string> {
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

export async function notificationExists(message: string, driver: WebDriver, timeout = 10000): Promise<Notification> {
    const center = await new Workbench().openNotificationsCenter();
    return driver.wait(async () => {
        try {
            const notifications = await center.getNotifications(NotificationType.Any);
            for (const item of notifications) {
                if (await item.getMessage() === message) {
                    return item;
                }
            }
        } catch (err) {
            // workaround for reloadin notifications
        }
    }, timeout);
}

export async function itemExists(title: string, view: ViewSection, timeout = 10000): Promise<ViewItem> {
    return view.getDriver().wait(async () => {
        try {
            const item = await view.findItem(title);
            if (item) {
                return item;
            }
        } catch (err) {
            return null;
        }
    }, timeout);
}

export async function itemHasText(title: string, text: string, view: ViewSection, timeout = 10_000 ): Promise<ViewItem> {
    return view.getDriver().wait(async () => {
        try {
            const item = await view.findItem(title);
            if (item) {
                const itemText = await item.getText();
                if (itemText.includes(text)) {
                    return item;
                }
            }
        } catch (err) {
            return null;
        }
    }, timeout)
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
        await new Promise(res => setTimeout(res, period));
    }, timeout);
}

export async function welcomeContentButtonsAreLoaded(welcomeContentSection: WelcomeContentSection, timeout = 60_000) {
    return welcomeContentSection.getDriver().wait(async () => {
        const buttons = await welcomeContentSection.getButtons();
        if(buttons.length > 0) {
            return buttons
        }
    }, timeout);
}

export async function webViewIsOpened(name: string, driver: WebDriver, timeout = 10_000) {
    return driver.wait(async () => {
        try {
            const editor = new EditorView();
            await editor.openEditor(name)
            return true;
        } catch(err) {
            return null;
        }
    }, timeout)
}