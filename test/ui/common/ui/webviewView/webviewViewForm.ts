/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { WebviewView } from 'vscode-extension-tester';

export abstract class WebviewViewForm {

    public async enterWebviewView<T>(callbackFunction: (webviewView: WebviewView) => Promise<T>): Promise<T> {
        const webviewView = new WebviewView();
        await webviewView.switchToFrame();
        let retValue: T;
        try {
            retValue = await callbackFunction(webviewView);
        } finally {
            await webviewView.switchBack();
        }
        return retValue;
    }
}
