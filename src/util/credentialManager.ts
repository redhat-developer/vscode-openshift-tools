/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import { env, ExtensionContext } from 'vscode';

const keytar: any = getVscodeModule('keytar');

export class TokenStore {
    public static extensionContext: ExtensionContext;

    static async setItem(key: string, login: string, value: string): Promise<void> {
        return keytar ? keytar.setPassword(key, login, value) : undefined;
    }

    static async getItem(key: string, login: string): Promise<string> {
        return keytar ? keytar.getPassword(key, login) : '';
    }

    static setUserName(username: string): Thenable<void> {
        return TokenStore.extensionContext.globalState.update('username', username);
    }

    static getUserName(): Thenable< string | undefined> {
        return TokenStore.extensionContext.globalState.get('username');
    }
}

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