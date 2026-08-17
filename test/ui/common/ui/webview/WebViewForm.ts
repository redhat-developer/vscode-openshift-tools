/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { By, Editor, EditorView, WebElement, WebView } from 'vscode-extension-tester';

/**
 * Web View form representation implementation
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export abstract class WebViewForm {

    private _editorName: string;
    private _editorView: EditorView;
    private _editor: Editor;

    constructor(name: string) {
        this._editorName = name;
        this._editorView = new EditorView();
    }

    public get editorView(): EditorView {
        return this._editorView;
    }

    public get editor(): Editor {
        if (this._editor) {
            return this._editor;
        }
        throw TypeError('Editor was not initialized yet');
    }

    public get editorName(): string {
        return this._editorName;
    }

    public async initializeEditor(): Promise<void> {
        this._editor = await this._editorView.openEditor(this.editorName);
    }

    public async enterWebView<T>(callbackFunction: (webView: WebView) => Promise<T>): Promise<T> {
        if (!this.editor) {
            await this.initializeEditor();
        }

        const webView = new WebView();
        await webView.switchToFrame();
        let retValue: T;
        try {
            retValue = await callbackFunction(webView);
        } finally {
            await webView.switchBack();
        }
        return retValue;
    }

    /**
     * Tries immediately first (so already-rendered pages - e.g. filling in one form field
     * after another - pay no extra latency), then falls back to sleeping upfront and checking
     * infrequently instead of polling the DOM in a tight loop. A tight driver.wait() loop re-runs
     * an XPath query on the webview's single JS thread every ~200ms, which can keep grabbing the
     * thread the page's own async rendering (e.g. Material-UI) needs to finish - starving it
     * instead of waiting for it. Sparse checks with real idle gaps let rendering actually complete.
     */
    protected async findElementSparse(webView: WebView, xpath: string, timeout = 15_000, pollInterval = 1_500, initialDelay = 2_000): Promise<WebElement> {
        try {
            const immediate = await webView.findWebElement(By.xpath(xpath));
            if (immediate) {
                return immediate;
            }
        } catch {
            // not there yet, fall through to the sparse retry loop
        }

        await new Promise((resolve) => setTimeout(resolve, initialDelay));

        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            try {
                const element = await webView.findWebElement(By.xpath(xpath));
                if (element) {
                    return element;
                }
            } catch {
                // not rendered yet, fall through to retry after the poll interval
            }
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }
        return null;
    }
}