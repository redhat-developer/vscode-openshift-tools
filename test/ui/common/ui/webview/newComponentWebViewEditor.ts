/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { By, WebElement, WebView } from 'vscode-extension-tester';
import { WebViewForm } from './WebViewForm';

//TODO: Add support for create from git page and from local codebase page

/**
 * @author lgrossma@redhat.com
 * Class represents WebView of Create Component form
 */

export class CreateComponentWebView extends WebViewForm {

    public constructor() {
        super('Create Component');
    }

    private async getCreateFromTemplateButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//div[..//h6[contains(text(),"From Template Project")]]/button'));
    }

    private async getCreateFromGitButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//*[@id="root"]/div/div/div[1]/div[2]/div[3]/button'));
    }

    private async getCreateFromLocalButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//*[@id="root"]/div/div/div[1]/div[1]/div[3]/button'));
    }

    public async createComponentFromTemplate(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getCreateFromTemplateButton(webView);
            await button.click();
        });
    }

    public async createComponentFromGit(): Promise<void> {
        await this.enterWebView(async (webView) => {
            await (await this.getCreateFromGitButton(webView)).click();
        });
    }

    public async createComponentFromLocalCodebase(): Promise<void> {
        await this.enterWebView(async (webView) => {
            await (await this.getCreateFromLocalButton(webView)).click();
        });
    }
}

/**
 * Class represents page that shows up after selecting a devfile
*/
export class TemplateProjectPage extends WebViewForm{

    public constructor(name: string) {
        super(name);
    }

    public async insertProjectFolderPath(path: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const pathField = await this.getProjectFolderPathField(webView);
            await pathField.sendKeys(path);
        });
    }

    public async clickSelectFolder(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getSelectFolderButton(webView);
            await button.click();
        })
    }

    public async clickCreateComponentButton(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getCreateComponentButton(webView);
            await button.click();
        });
    }

    private async getSelectFolderButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//button[contains(text(), "Select Folder")]'));
    }

    private async getProjectFolderPathField(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//div[./label[contains(text(), "Project Folder Path")]]//input'));
    }

    private async getCreateComponentButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//span[contains(text(), "Create Component")]'));
    }
}