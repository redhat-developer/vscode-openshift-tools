/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { By, Key, WebElement, WebView } from 'vscode-extension-tester';
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

    public async clearProjectFolderPath(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const pathField = await this.getProjectFolderPathField(webView);
            const controlKey = process.platform === 'darwin' ? Key.COMMAND : Key.CONTROL;
            await pathField.sendKeys(`${controlKey} ${'a'}`);
            await pathField.sendKeys(Key.DELETE);
        });
    }

    public async clickSelectFolder(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getSelectFolderButton(webView);
            await button.click();
        });
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

abstract class Page extends WebViewForm {

    public constructor() {
        super('Create Component');
    }

    public async clickNextButton(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getNextButton(webView);
            await button.click();
        });
    }

    /**
     * The button is shown only after filling all necessary fields and clicking the "Next" button
     */
    public async clickSelectDifferentDevfileButton(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getSelectDifferentDevfileButton(webView);
            await button.click();
        });
    }

    private async getNextButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//button[contains(text(), "NEXT")]'));
    }

    private async getSelectDifferentDevfileButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//button[contains(text(), "SELECT A DIFFERENT DEVFILE")]'));
    }
}

/**
 * Class represents page that shows up after selecting to create a component from Git
 * @author Lukas Grossmann <lgrossma@redhat.com>
 */
export class GitProjectPage extends Page {

    public constructor() {
        super();
    }

    public async insertGitLink(link: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const linkField = await this.getGitRepositoryLinkField(webView);
            await linkField.sendKeys(link);
        });
    }

    /**
     * The button is shown only after filling all necessary fields and clicking the "Next" button
     */
    public async clickContinueButton(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.continueButtonExists(webView);
            await button.click();
        });
    }

    private async continueButtonExists(webView: WebView, timeout = 60_000): Promise<WebElement> {
        return webView.getDriver().wait(async () => {
            try {
                const button = await this.getContinueButton(webView);
                if (button) {
                    return button;
                }
            } catch {
                return null;
            }
        }, timeout);
    }

    private async getContinueButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//button[contains(text(), "CONTINUE WITH THIS DEVFILE")]'));
    }

    private async getGitRepositoryLinkField(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//div[./label[contains(text(), "Link to Git Repository")]]//input'));
    }
}

export class LocalCodeBasePage extends Page {

    public constructor() {
        super();
    }

    public async insertComponentName(name: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const nameField = await this.getComponentNameField(webView);
            await nameField.sendKeys(name);
        });
    }

    public async clickSelectFolderButton(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getSelectFolderButton(webView);
            await button.click();
        });
    }

    public async clickCreateComponent(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.createButtonExists(webView);
            await button.click();
        });
    }

    private async getComponentNameField(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//div[./label[contains(text(), "Component Name")]]//input'));
    }

    private async getSelectFolderButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//button[contains(text(), "Select Folder")]'));
    }

    private async createButtonExists(webView: WebView, timeout = 60_000): Promise<WebElement> {
        return webView.getDriver().wait(async () => {
            try {
                const button = await this.getCreateComponentButton(webView);
                if (button) {
                    return button;
                }
            } catch {
                return null;
            }
        }, timeout);
    }

    private async getCreateComponentButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//span[contains(text(), "Create Component")]'));
    }
}
