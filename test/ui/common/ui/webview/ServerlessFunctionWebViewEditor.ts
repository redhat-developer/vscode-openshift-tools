/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { By, InputBox, Key, WebElement, WebView } from 'vscode-extension-tester';
import { WebViewForm } from './WebViewForm';

export class ServerlessFunctionWebView extends WebViewForm {

    public constructor() {
        super('Serverless Function - Create');
    }

    public async insertFunctionName(name: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const nameField = await this.getInsertFunctionNameInput(webView);
            await nameField.sendKeys(`${name}${Key.ENTER}`);
        });
    }

    public async selectBuildImage(image: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const  buildImageField = await this.getSelectBuildImageInput(webView);
            await buildImageField.sendKeys(`${image}${Key.ARROW_DOWN}${Key.ENTER}`);
        });
    }

    public async selectLanguage(language: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const languageField = await this.getSelectLanguageInput(webView);
            await languageField.sendKeys(`${language}${Key.ARROW_DOWN}${Key.ENTER}`);
        });
    }

    public async selectTemplate(template: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const templateField = await this.getSelectTemplateInput(webView);
            await templateField.sendKeys(`${template}${Key.ARROW_DOWN}${Key.ENTER}`);
        });
    }

    public async selectFolder(path: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const folderField = await this.getSelectFolderInput(webView);
            await folderField.click();
            await folderField.sendKeys(`${Key.ARROW_DOWN}${Key.ENTER}`);
        });

        const input = await InputBox.create();
        await input.setText(path);
        await input.confirm();
    }

    public async clickCreateButton(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getCreateButton(webView);
            await button.click();
        });
    }

    private async getInsertFunctionNameInput(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//input[@placeholder="Provide name of the function to be created"]'));
    }

    private async getSelectBuildImageInput(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//input[@placeholder="Provide full image name (podman, docker, quay)"]'));
    }

    private async getSelectLanguageInput(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//input[@placeholder="Select the Language Runtime"]'));
    }

    private async getSelectTemplateInput(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//input[@placeholder="Select the Function template"]'));
    }

    private async getSelectFolderInput(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//input[@placeholder="Select the folder to initialise the function at that path"]'));
    }

    private async getCreateButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//button[contains(text(), "Create")]'));
    }

}