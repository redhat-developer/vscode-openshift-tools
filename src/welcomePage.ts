/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { vsCommand } from './vscommand';
import WelcomeViewLoader from './webview/welcome/welcomeViewLoader';

export class WelcomePage {

    static async createOrShow(): Promise<void> {
        if (vscode.workspace.getConfiguration('openshiftToolkit').get('showWelcomePage')) {
            await WelcomePage.createOrShowNoCheck();
        }
    }

    @vsCommand('openshift.welcome')
    static async createOrShowNoCheck(): Promise<void> {
        await WelcomeViewLoader.loadView('Welcome - OpenShift Toolkit');
    }

    @vsCommand('openshift.getStarted')
    static async showGetStarted(name: string): Promise<void> {
        await vscode.commands.executeCommand('workbench.action.openWalkthrough', {
            category: `redhat.vscode-openshift-connector#${name}`
        }, false);
    }
}
