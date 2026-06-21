/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

// Style imports
declare module '*.scss' {
    const content: any;
    export = content;
}

declare module '*.css' {
    const content: any;
    export = content;
}

// VSCode webview API augmentation
declare global {
    interface Window {
        vscodeApi: any;
    }
}

// Make this a module so `declare global` works
export {};

