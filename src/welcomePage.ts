/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { workspace } from 'vscode';
import { ExtenisonID } from './util/constants';
import { WelcomeWebview } from 'vscode-welcome-view';
import path = require('path');
import { vsCommand } from './vscommand';

export class WelcomePage {

    static createOrShow(): void {
        if(workspace.getConfiguration('openshiftConnector').get('showWelcomePage')) {
            WelcomePage.createOrShowCmd();
        }
    }

    @vsCommand('openshift.welcome')
    static createOrShowCmd(): void {
        WelcomeWebview.createOrShow(ExtenisonID, path.resolve(__dirname, '..', '..'), path.join('welcome', 'app', 'assets'), 'openshiftConnector.showWelcomePage');
    }
}