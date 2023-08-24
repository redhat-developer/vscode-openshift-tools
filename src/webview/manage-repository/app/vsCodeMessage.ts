/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

declare const acquireVsCodeApi: Function;

interface VSCodeApi {
    getState: () => any;
    setState: (newState: any) => any;
    postMessage: (message: any) => void;
}

class VSCodeWrapper {
    private readonly vscodeApi: VSCodeApi = acquireVsCodeApi();

    /**
     * Send message to the extension framework.
     * @param message
     */
    public postMessage(message: any): void {
        this.vscodeApi.postMessage(message);
    }

    /**
     * Add listener for messages from extension framework.
     * @param callback called when the extension sends a message
     * @returns function to clean up the message eventListener.
     */
    public onMessage(callback: (message: any) => void): () => void {
        window.addEventListener('message', callback);
        return () => window.removeEventListener('message', callback);
    }
}

// Singleton to prevent multiple fetches of VsCodeAPI.
export const VSCodeMessage: VSCodeWrapper = new VSCodeWrapper();
