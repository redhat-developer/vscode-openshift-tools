/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftObject, Command } from "../odo";
import { OpenShiftItem } from './openshiftItem';
import * as vscode from 'vscode';
import { CliExitData } from "../cli";
import opn = require("opn");

export class Cluster extends OpenShiftItem {

    static async login(): Promise<string> {
        if (await Cluster.odo.requireLogin()) {
            return Cluster.loginDialog();
        } else {
            const value = await vscode.window.showInformationMessage(`You are already logged in the cluster. Do you want to login to a different cluster?`, 'Yes', 'No');
            if (value === 'Yes') {
                return Cluster.loginDialog();
            }
            return null;
        }
    }

    static async logout(): Promise<string> {
        const value = await vscode.window.showWarningMessage(`Do you want to logout of cluster?`, 'Logout', 'Cancel');
        if (value === 'Logout') {
            return Cluster.odo.execute(Command.odoLogout())
            .catch((error) => Promise.reject(`Failed to logout of the current cluster with '${error}'!`))
            .then(async (result) => {
                if (result.stderr === "") {
                    Cluster.explorer.refresh();
                    vscode.commands.executeCommand('setContext', 'isLoggedIn', false);
                    const logoutInfo = await vscode.window.showInformationMessage(`Successfully logged out. Do you want to login to a new cluster`, 'Yes', 'No');
                    if (logoutInfo === 'Yes') {
                        return Cluster.login();
                    } else {
                        return null;
                    }
                } else {
                    return Promise.reject(`Failed to logout of the current cluster with '${result.stderr}'!`);
                }
            });
        }
        return null;
    }

    static refresh(): void {
        Cluster.explorer.refresh();
    }

    static about(): void {
        Cluster.odo.executeInTerminal(Command.printOdoVersion());
    }

    static async openshiftConsole(context: OpenShiftObject): Promise<void> {
        if (context) {
            opn(context.getName());
        } else {
            const result: OpenShiftObject[] = await Cluster.odo.getClusters();
            if (result.length>0 && result[0].getName().startsWith('http')) {
                opn(result[0].getName());
            } else {
                vscode.window.showErrorMessage(result[0].getName());
            }
        }
    }

    static async getUrl(): Promise<string> {
        return await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: "Provide URL of the cluster to connect",
            validateInput: (value: string) => Cluster.validateUrl('Invalid URL provided', value)
        });
    }

    private static async loginDialog(): Promise<string> {
        const loginMethod = await vscode.window.showQuickPick(['Credentials', 'Token'], {placeHolder: 'Select the way to log in to the cluster.'});
        if (loginMethod === "Credentials") {
            return Cluster.credentialsLogin('do not check login status');
        } else {
            return Cluster.tokenLogin('do not check login status');
        }
    }

    private static async getClusterUrl(message: string): Promise<string> {
        if (!await Cluster.odo.requireLogin() && !message) {
            const value = await vscode.window.showInformationMessage(`You are already logged in the cluster. Do you want to login to a different cluster?`, 'Yes', 'No');
            if (value === 'Yes') return await Cluster.getUrl();
            return null;
        } else {
            return await Cluster.getUrl();
        }
    }

    static async credentialsLogin(message: string): Promise<string> {
        const clusterURL = await Cluster.getClusterUrl(message);
        if (!clusterURL) return null;
        const username = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: "Provide Username for basic authentication to the API server",
            validateInput: (value: string) => Cluster.emptyName('User name cannot be empty', value)
        });
        if (!username) return null;
        const passwd  = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            password: true,
            prompt: "Provide Password for basic authentication to the API server"
        });
        if (!passwd) return null;
        return Promise.resolve()
            .then(() => Cluster.odo.execute(Command.odoLoginWithUsernamePassword(clusterURL, username, passwd)))
            .then((result) => Cluster.loginMessage(clusterURL, result))
            .catch((error) => Promise.reject(`Failed to login to cluster '${clusterURL}' with '${error}'!`));
    }

    static async tokenLogin(message: string): Promise<string> {
        const clusterURL = await Cluster.getClusterUrl(message);
        if (!clusterURL) return null;
        const ocToken = await vscode.window.showInputBox({
            prompt: "Provide Bearer token for authentication to the API server",
            ignoreFocusOut: true
        });
        if (!ocToken) return null;
        return Promise.resolve()
            .then(() => Cluster.odo.execute(Command.odoLoginWithToken(clusterURL, ocToken)))
            .then((result) => Cluster.loginMessage(clusterURL, result))
            .catch((error) => Promise.reject(`Failed to login to cluster '${clusterURL}' with '${error}'!`));
    }

    private static async loginMessage(clusterURL: string, result: CliExitData): Promise<string> {
        if (result.stderr === "") {
            Cluster.explorer.refresh();
            return vscode.commands.executeCommand('setContext', 'isLoggedIn', true)
                .then(() => `Successfully logged in to '${clusterURL}'`);
        } else {
            return Promise.reject(result.stderr);
        }
    }
}