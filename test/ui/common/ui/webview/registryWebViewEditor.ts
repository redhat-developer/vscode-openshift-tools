/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { By, ModalDialog, WebElement, WebView } from 'vscode-extension-tester';
import { WebViewForm } from './WebViewForm';

/**
 * @author odockal@redhat.com, lgrossma@redhat.com
 * Class represents Registry Stack item in web View form
 */
export class RegistryStackItem {
    private _element: WebElement;

    public constructor(element: WebElement) {
        this._element = element;
    }

    public get element(): WebElement {
        return this._element;
    }

    public async getStackName() {
        return await this._element.getText();
    }

    public async selectStack() {
        await this._element.click();
    }
}

export class RegistryWebViewProject {
    private _stackName: string;

    public get stackName(): string {
        return this._stackName;
    }

    public set stackName(value: string) {
        this._stackName = value;
    }

    public constructor(stackName: string) {
        this._stackName = stackName;
    }

    public async getParent(): Promise<string> {
        const modal = new ModalDialog();
        return await modal.getMessage();
    }
}

export class RegistryWebViewEditor extends WebViewForm {

    public constructor(name: string) {
        super(name);
    }

    private async getRegistryStacks(webView: WebView): Promise<WebElement[]> {
        return await webView.findWebElements(By.xpath('//div[@id="devfileList"]//p[@id="devfileName"]'));
    }

    private async getRegistryStacksItems(webView: WebView): Promise<RegistryStackItem[]> {
        const stacks = await this.getRegistryStacks(webView);
        const array = [] as RegistryStackItem[];
        for(const item of stacks) {
            const stack = new RegistryStackItem(item);
            array.push(stack);
        }
        return array;
    }

    public async getRegistryStackNames(): Promise<string[]> {
        const items = await this.enterWebView(async (webView) => {
            const array = [] as string [];
            const stacks = await this.getRegistryStacksItems(webView);
            for(const stack of stacks) {
                array.push(await stack.getStackName());
            }
            return array;
        });
        return items;
    }

    public async selectRegistryStack(stackName: string): Promise<void> {
        await this.enterWebView(async (webView) => {
            const stacks = await this.getRegistryStacksItems(webView);
            for(const stack of stacks) {
                if((await stack.getStackName()).includes(stackName)) {
                    await stack.selectStack();
                    return;
                }
            }
        });
    }
}

export class RegistryWebViewDevfileWindow extends WebViewForm {
    //TODO: Add more functionality to class to cover all elements

    public constructor(name: string) {
        super(name)
    }

    public async clickListBox(): Promise<void> {
        await (await this.getListBox()).click();
    }

    public async getListBox(): Promise<WebElement> {
        const listBox = this.enterWebView( async (webView) => {
            return await webView.findWebElement(By.xpath('//svg[@data-testid="ArrowDropDownIcon"]'));
        })
        return listBox;
    }

    public async useDevfile(): Promise<void> {
        await this.enterWebView(async (webView) => {
            const button = await this.getUseDevfileButton(webView);
            await button.click();
        });
    }

    private async getUseDevfileButton(webView: WebView): Promise<WebElement> {
        return await webView.findWebElement(By.xpath('//button[contains(text(), "Use Devfile")]'));
    }
}
