/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { vsCommand } from './vscommand';
import WelcomeViewLoader from './webview/welcome/welcomeViewLoader';

export class WelcomePage {

    @vsCommand('openshift.welcome')
    static async createOrShow(): Promise<void> {
        if (vscode.workspace.getConfiguration('openshiftConnector').get('showWelcomePage')) {
            await WelcomeViewLoader.loadView('Welcome');
        }
    }

    @vsCommand('openshift.getStarted')
    static async showGetStarted(): Promise<void> {
        await vscode.commands.executeCommand('workbench.action.openWalkthrough', {
            category: 'redhat.vscode-openshift-connector#openshiftWalkthrough'
        }, false);
    }
}
