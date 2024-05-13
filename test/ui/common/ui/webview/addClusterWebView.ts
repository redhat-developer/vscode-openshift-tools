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
        })
    }

    private async getCreateRefreshClusterButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//span[contains(text(),"Create/Refresh cluster")]'));
    }

    private async getStartYourOpenshiftExperienceButton(webView: WebView): Promise<WebElement> {
        return await webView.findElement(By.xpath('//span[contains(text(),"Start your OpenShift experience")]'));
    }
}