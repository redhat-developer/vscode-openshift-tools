/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { BottomBarPanel, InputBox, Notification, NotificationType, ViewItem, ViewSection, WebDriver, Workbench } from 'vscode-extension-tester';

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