/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
type ActionMessage = {
    action: string;
} | { [key: string]: any; };

interface VscodeAPI {
    postMessage(message: ActionMessage): void;
}

interface Window {
    cmdText?: string;
    vscodeApi: VscodeAPI;
    acquireVsCodeApi: () => VscodeAPI;
}
