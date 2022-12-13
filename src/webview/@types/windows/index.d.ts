/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
interface ActionMessage {
    action: string;
    params: any;
}

interface VscodeAPI {
    postMessage(message: ActionMsg): void;
}

interface Window {
    cmdText?: string;
    startingPage?: string;
    vscodeApi: VscodeAPI;
    acquireVsCodeApi: () => VscodeAPI;
}