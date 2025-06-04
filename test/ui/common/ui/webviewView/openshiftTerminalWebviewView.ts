/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import clipboard from 'clipboardy';
import { By, Key, VSBrowser, WebElement, WebviewView } from 'vscode-extension-tester';
import { WebviewViewForm } from './webviewViewForm';

export class OpenshiftTerminalWebviewView extends WebviewViewForm {
    public constructor() {
        super();
    }

    public async getTerminalText(): Promise<string> {
        const copyKeys = [`${Key.CONTROL}${Key.SHIFT}a`, `${Key.CONTROL}${Key.SHIFT}c`];
        return await VSBrowser.instance.driver.wait(
            async () => {
                try {
                    await this.sendKeysToTerminal(copyKeys);
                    return await clipboard.read();
                } catch {
                    return null;
                }
            },
            10_000,
            'Could not find any text in terminal in 10 seconds',
        );
    }

    public async getActiveTabName(): Promise<string> {
        let text: string;
        await this.enterWebviewView(async (webviewView) => {
            const activeTab = await this.getActiveTab(webviewView);
            text = await activeTab.getText();
        });
        return text;
    }

    public async closeTab(name: string): Promise<void> {
        await this.enterWebviewView(async (webviewView) => {
            const closeButton = await webviewView.findWebElement(
                By.xpath(`//div[div[contains(text(),"${name}")]]//*[@data-testid="CloseIcon"]`),
            );
            await closeButton.click();
        });
    }

    public async closeActiveTab(): Promise<void> {
        await this.enterWebviewView(async (webviewView) => {
            await webviewView.findWebElement(
                By.xpath('//button[@aria-selected = "true"]//*[@data-testid = "TerminalIcon"]'),
            );
        });
    }

    public async closeAllInactiveTabs(): Promise<void> {
        await this.enterWebviewView(async (webviewView) => {
            const closeButtons = await webviewView.findWebElements(
                By.xpath('//button[@aria-selected = "false"]//*[@data-testid = "TerminalIcon"]'),
            );
            for (const button of closeButtons) {
                await button.click();
            }
        });
    }

    public async switchToTab(name: string): Promise<void> {
        await this.enterWebviewView(async (webviewView) => {
            const tabs = await this.getTerminalTabs(webviewView);
            for (const tab of tabs) {
                const text = await tab.getText();
                if (text === name) {
                    await tab.click();
                }
            }
        });
    }

    public async sendKeysToTerminal(keys: string[]): Promise<void> {
        await this.enterWebviewView(async (webviewView) => {
            const terminal = await this.getTerminalInstance(webviewView);
            await terminal.click();
            for (const key of keys) {
                await terminal.sendKeys(key);
            }
        });
    }

    public async isAnyTabOpened(): Promise<boolean> {
        let tabs: WebElement[];
        await this.enterWebviewView(async (webviewView) => {
            tabs = await this.getTerminalTabs(webviewView);
        });
        return tabs.length > 0;
    }

    private async getActiveTab(webviewView: WebviewView): Promise<WebElement> {
        return await webviewView.findWebElement(
            By.xpath('//button[@aria-selected = "true"]//div[*[name() = "svg"]]/div'),
        );
    }

    private async getTerminalTabs(webviewView: WebviewView): Promise<WebElement[]> {
        return await webviewView.findWebElements(By.xpath('//div[*[name() = "svg"]]/div'));
    }

    private async getTerminalInstance(webviewView: WebviewView): Promise<WebElement> {
        return await webviewView.findWebElement(
            By.xpath('//textarea[@aria-label = "Terminal input"]'),
        );
    }
}
