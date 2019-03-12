/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as keytar from 'keytar';
import { contextGlobalState } from '../extension';

export class TokenStore {

    static setItem(key: string, login: string, value: string): Promise<void> {
        return keytar.setPassword(key, login, value);
    }

    static getItem(key: string, login: string): Promise<string> {
        return keytar.getPassword(key, login);
    }

    static setUserName(username: string): Thenable<void> {
        return contextGlobalState.globalState.update('username', username);
    }

    static getUserName(): Thenable< string | undefined> {
        return contextGlobalState.globalState.get('username');
    }
}