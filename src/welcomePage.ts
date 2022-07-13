/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { workspace } from 'vscode';
import { vsCommand } from './vscommand';
import WelcomeViewLoader from './webview/welcome/welcomeViewLoader';

export class WelcomePage {

    @vsCommand('openshift.welcome')
    static async createOrShow(): Promise<void> {
        if(workspace.getConfiguration('openshiftConnector').get('showWelcomePage')) {
            await WelcomeViewLoader.loadView('Welcome');
        }
    }
}
