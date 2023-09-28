/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */

import { env, ExtensionContext } from 'vscode';

export function getVscodeModule<T>(moduleName: string): T | undefined {
    try {
        return require(`${env.appRoot}/node_modules.asar/${moduleName}`);
    } catch (err) {
        // Not in ASAR.
    }
    try {
        return require(`${env.appRoot}/node_modules/${moduleName}`);
    } catch (err) {
        // Not available.
    }
    return undefined;
}

export class TokenStore {
    public static extensionContext: ExtensionContext;

    static async setItem(key: string, login: string, value: string): Promise<void> {
        const loginKey: string = JSON.stringify({key, login});
        await this.extensionContext.secrets.store(loginKey, value);
    }

    static async getItem(key: string, login: string): Promise<string> {
        const loginKey: string = JSON.stringify({key, login});
        return await this.extensionContext.secrets.get(loginKey);
    }

    static setUserName(username: string): Thenable<void> {
        return TokenStore.extensionContext.globalState.update('username', username);
    }

    static getUserName(): Thenable<string | undefined> {
        return TokenStore.extensionContext.globalState.get('username');
    }
}
