/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import got from 'got/dist/source';
import { authentication, AuthenticationSession, window } from 'vscode';
import { vsCommand } from '../vscommand';

export class Auth {

    @vsCommand('openshift.sandbox.login')
    public static async login(): Promise<any> {
        const session: AuthenticationSession = await authentication.getSession('redhat-account-auth', ['openid'], { createIfNone: true });
        if (!session) {
            window.showWarningMessage('You need to log into Red Hat first!');
            return [];
        }
        console.log(session);
        const data = await got.get('https://registration-service-toolchain-host-operator.apps.sandbox.x8i5.p1.openshiftapps.com/api/v1/signup', {
            headers: {
                Authorization: `Bearer ${(session as any).idToken}`
            }
        });
        console.log(data.body);
    }
}