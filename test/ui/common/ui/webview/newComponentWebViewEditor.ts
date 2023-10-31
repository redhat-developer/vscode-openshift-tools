/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { By, WebElement, WebView } from 'vscode-extension-tester';
import { WebViewForm } from './WebViewForm';

//TODO: Add support for create from git page and from local codebase page

/**
 * @author Lukas Grossmann <lgrossma@redhat.com>
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
        return await webView.findWebElement(By.xpath('//div[..//h6[contains(text(),"From Existing Remote Git Repository")]]/button'));
    }

    private async getCreateFromLocalButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//div[..//h6[contains(text(),"From Existing Local Codebase")]]/button'));
    }

    public async createComponentFromTemplate(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getCreateFromTemplateButton(webView);
            await button.click();
        });
    }

    public async createComponentFromGit(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getCreateFromGitButton(webView);
            await button.click();
        });
    }

    public async createComponentFromLocalCodebase(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getCreateFromLocalButton(webView);
            await button.click();
        });
    }
}

/**
 * Class represents page that shows up after selecting a devfile
 * @author Lukas Grossmann <lgrossma@redhat.com>
*/
export class SetNameAndFolderPage extends WebViewForm {

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

/**
 * Class represents page that shows up after selecting to create a component from Git
 * @author Lukas Grossmann <lgrossma@redhat.com>
 */
export class GitProjectPage extends WebViewForm {

    public constructor() {
        super('Create Component');
    }

    public async insertGitLink(link: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const linkField = await this.getGitRepositoryLinkField(webView);
            await linkField.sendKeys(link)
        });
    }

    public async clickNextButton(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getNextButton(webView);
            await button.click();
        })
    }

    public async clickContinueButton(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getContinueButton(webView);
            await button.click()
        });
    }

    public async clickSelectDifferentDevfileButton(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getSelectDifferentDevfileButton(webView);
            await button.click()
        });
    }

    private async getGitRepositoryLinkField(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//div[./label[contains(text(), "Link to Git Repository")]]//input'));
    }

    private async getNextButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//button[contains(text(), "NEXT")]'));
    }

    private async getContinueButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//button[contains(text(), "CONTINUE WITH THIS DEVFILE")]'));
    }

    private async getSelectDifferentDevfileButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//button[contains(text(), "SELECT A DIFFERENT DEVFILE")]'));
    }

}