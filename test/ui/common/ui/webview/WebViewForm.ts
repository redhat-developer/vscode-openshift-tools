/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Editor, EditorView, WebView } from 'vscode-extension-tester';

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
}