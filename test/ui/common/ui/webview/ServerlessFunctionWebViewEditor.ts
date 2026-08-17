/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { expect } from 'chai';
import { InputBox, Key, WebElement, WebView } from 'vscode-extension-tester';
import { WebViewForm } from './WebViewForm';

export class ServerlessFunctionWebView extends WebViewForm {

    public constructor() {
        super('Serverless Function - Create');
    }

    public async insertFunctionName(name: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const nameField = await this.getInsertFunctionNameInput(webView);
            expect(nameField, 'Function name input should be found').to.exist;
            await nameField.sendKeys(`${name}${Key.ENTER}`);
        });
    }

    public async selectBuildImage(image: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const  buildImageField = await this.getSelectBuildImageInput(webView);
            expect(buildImageField, 'Build image input should be found').to.exist;
            await buildImageField.sendKeys(`${image}${Key.ARROW_DOWN}${Key.ENTER}`);
        });
    }

    public async selectLanguage(language: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const languageField = await this.getSelectLanguageInput(webView);
            expect(languageField, 'Language runtime input should be found').to.exist;
            await languageField.sendKeys(`${language}${Key.ARROW_DOWN}${Key.ENTER}`);
        });
    }

    public async selectTemplate(template: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const templateField = await this.getSelectTemplateInput(webView);
            expect(templateField, 'Function template input should be found').to.exist;
            await templateField.sendKeys(`${template}${Key.ARROW_DOWN}${Key.ENTER}`);
        });
    }

    public async selectFolder(path: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const folderField = await this.getSelectFolderInput(webView);
            expect(folderField, 'Folder input should be found').to.exist;
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
            expect(button, 'Create button should be found').to.exist;
            await button.click();
        });
    }

    private async getInsertFunctionNameInput(webView: WebView): Promise<WebElement> {
        // This is the first webview interaction in the suite, so it can pay the same
        // "cold render" cost seen in Add Cluster's first button - give it more room.
        return this.findElementSparse(webView, '//input[@placeholder="Provide name of the function to be created"]', 35_000);
    }

    private async getSelectBuildImageInput(webView: WebView): Promise<WebElement> {
        return this.findElementSparse(webView, '//input[@placeholder="Provide full image name (podman, docker, quay)"]');
    }

    private async getSelectLanguageInput(webView: WebView): Promise<WebElement> {
        return this.findElementSparse(webView, '//input[@placeholder="Select the Language Runtime"]');
    }

    private async getSelectTemplateInput(webView: WebView): Promise<WebElement> {
        return this.findElementSparse(webView, '//input[@placeholder="Select the Function template"]');
    }

    private async getSelectFolderInput(webView: WebView): Promise<WebElement> {
        return this.findElementSparse(webView, '//input[@placeholder="Select the folder to initialise the function at that path"]');
    }

    private async getCreateButton(webView: WebView): Promise<WebElement> {
        return this.findElementSparse(webView, '//button[contains(text(), "Create")]');
    }

}