/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { By, WebElement, WebView } from 'vscode-extension-tester';
import { WebViewForm } from './WebViewForm';

export class CreateServiceWebView extends WebViewForm {

    public constructor() {
        super('Create Service');
    }

    public async clickComboBox(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const comboBox = await this.comboBoxExists(webView);
            await comboBox.click();
        });
    }

    public async selectItemFromComboBox(text: string, dataValue: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const item = await this.getElementFromComboBox(webView, text, dataValue);
            await item.click();
        });
    }

    public async clickNext(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.nextButtonExists(webView);
            await button.click();
        });
    }

    private async getServiceKindToCreateComboBox(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//div[@role="combobox"]'));
    }

    private async getElementFromComboBox(webView: WebView, text: string, dataValue: string): Promise<WebElement> {
        return await webView.findWebElement(By.xpath(`//li[contains(text(), "${text}") and @data-value="${dataValue}"]`));
    }

    private async getNextButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//button[contains(text(), "Next")]'));
    }

    private async comboBoxExists(webView: WebView, timeout = 10_000): Promise<WebElement> {
        return webView.getDriver().wait(async () => {
            try {
                const comboBox = await this.getServiceKindToCreateComboBox(webView);
                if (comboBox) {
                    return comboBox;
                }
            } catch {
                return null;
            }
        }, timeout);
    }

    private async nextButtonExists(webView: WebView, timeout = 10_000): Promise<WebElement> {
        return webView.getDriver().wait(async () => {
            try {
                const button = await this.getNextButton(webView);
                if (button) {
                    return button;
                }
            } catch {
                return null;
            }
        }, timeout);
    }
}

export class ServiceSetupPage extends WebViewForm {

    public constructor() {
        super('Create Service')
    }

    public async clickSubmit(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.submitButtonExists(webView);
            await button.click();
        });
    }

    public async getName(): Promise<string> {
        return await this.enterWebView(async (webView) => {
            const nameField = await this.nameFieldExists(webView);
            return await nameField.getAttribute('value');
        });
    }

    private async getSubmitButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//button[contains(text(), "Submit")]'));
    }

    private async getNameField(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//input[@id="root_metadata_name"]'));
    }

    private async submitButtonExists(webView: WebView, timeout = 10_000): Promise<WebElement> {
        return webView.getDriver().wait(async () => {
            try {
                const button = await this.getSubmitButton(webView);
                if (button) {
                    return button;
                }
            } catch {
                return null;
            }
        }, timeout);
    }

    private async nameFieldExists(webView: WebView, timeout = 10_000): Promise<WebElement> {
        return webView.getDriver().wait(async () => {
            try {
                const field = await this.getNameField(webView);
                if (field) {
                    return field;
                }
            } catch {
                return null;
            }
        }, timeout)
    }
}