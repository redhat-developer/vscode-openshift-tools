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

export class AddClusterWebView extends WebViewForm {

    public constructor() {
        super('Add OpenShift Cluster');
    }

    public async addLocalCluster(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getCreateRefreshClusterButton(webView);
            await button.click();
        });
    }

    public async addDevSandbox(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getStartYourOpenshiftExperienceButton(webView);
            await button.click();
        });
    }

    public async checkLearningButton(): Promise<void> {
        await this.enterWebView(async (webView) => {
            await this.getStartLearningButton(webView);
        });
    }

    public async checkRosaButton(): Promise<void> {
        await this.enterWebView(async (webView) => {
            await this.getRosaButton(webView);
        });
    }

    private async getCreateRefreshClusterButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//*[contains(text(),"Create/Refresh cluster")]'));
    }

    private async getStartYourOpenshiftExperienceButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//*[contains(text(),"Start your OpenShift experience")]'));
    }

    private async getStartLearningButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//*[contains(text(),"Start Learning")]'));
    }

    private async getRosaButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//*[contains(text(),"Create a ROSA cluster")]'));
    }
}

export class LocalClusterWebViewPage extends WebViewForm {

    public constructor() {
        super('Add OpenShift Cluster');
    }

    public async checkText(): Promise<void> {
        await this.enterWebView(async (webView) => {
            await this.getText(webView);
        });
    }

    public async checkDownloadButton(): Promise<void> {
        await this.enterWebView(async (webView) => {
            await this.getDownloadButton(webView);
        });
    }

    public async checkPathButton(): Promise<void> {
        await this.enterWebView(async (webView) => {
            await this.getPathButton(webView);
        });
    }

    public async clickBack(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getBackButton(webView);
            await button.click();
        })
    }

    private async getText(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//*[contains(text(),"Red Hat OpenShift Local brings a minimal OpenShift 4 cluster")]'));
    }

    private async getDownloadButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//*[@role="button" and contains(text(),"Download OpenShift Local")]'));
    }

    private async getPathButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//*[contains(text(),"Select Path")]'));
    }

    private async getBackButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//button[contains(text(),"Back")]'));
    }
}

export class DevSandboxWebViewPage extends WebViewForm {

    public constructor() {
        super('Add OpenShift Cluster');
    }

    public async checkText(): Promise<void> {
        await this.enterWebView(async (webView) => {
            await this.getText(webView);
        });
    }

    public async checkLoginButton(): Promise<void> {
        await this.enterWebView(async (webView) => {
            await this.getLoginButton(webView);
        });
    }

    public async checkSignUpButton(): Promise<void> {
        await this.enterWebView(async (webView) => {
            await this.getSignUpButton(webView);
        });
    }

    public async clickBack(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getBackButton(webView);
            await button.click();
        })
    }

    private async getText(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//*[contains(text(),"The sandbox provides you with a private OpenShift environment")]'));
    }

    private async getLoginButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//*[contains(text(),"Login to Red Hat")]'));
    }

    private async getSignUpButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//*[contains(text(),"Sign Up")]'));
    }

    private async getBackButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//button[contains(text(),"Back")]'));
    }
}