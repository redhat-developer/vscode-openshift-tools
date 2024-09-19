/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { By, WebElement, WebView } from 'vscode-extension-tester';
import { WebViewForm } from './WebViewForm';

export class AddServiceBindingWebView extends WebViewForm {

    public constructor() {
        super('Add service binding');
    }

    public async clickComboBox(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const comboBox = await this.comboBoxExists(webView);
            await comboBox.click();
        });
    }

    public async selectItemFromComboBox(text: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const item = await this.getElementFromComboBox(webView, text);
            await item.click();
        });
    }

    public async setBindingName(name: string) {
        await this.enterWebView(async (webView) => {
            const item = await this.getBindingNameInput(webView);
            await item.click();
            await item.sendKeys(name);
        });
    }

    public async clickAddServiceBindingButton(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.addServiceBindingButtonExists(webView);
            await button.click();
        });
    }

    private async getServiceToBindComboBox(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//div[@role="combobox"]'));
    }

    private async getElementFromComboBox(webView: WebView, text: string): Promise<WebElement> {
        return await webView.findWebElement(By.xpath(`//li[contains(text(), "${text}")]`));
    }

    private async getBindingNameInput(webView: WebView): Promise<WebElement> {
        return webView.findWebElement(By.xpath('//input[@id="binding-name"]'));
    }

    private async getAddServiceBindingButton(webView: WebView): Promise<WebElement> {
        return webView.findWebElement(By.xpath('//button[contains(text(), "Add Service Binding")]'));
    }

    private async comboBoxExists(webView: WebView, timeout = 15_000): Promise<WebElement> {
        return webView.getDriver().wait(async () => {
            try {
                const comboBox = await this.getServiceToBindComboBox(webView);
                if (comboBox) {
                    return comboBox;
                }
            } catch {
                return null;
            }
        }, timeout);
    }

    private async addServiceBindingButtonExists(webView: WebView, timeout = 10_000): Promise<WebElement> {
        return webView.getDriver().wait(async () => {
            try {
                const button = await this.getAddServiceBindingButton(webView);
                if (button) {
                    return button;
                }
            } catch {
                return null;
            }
        }, timeout);
    }
}