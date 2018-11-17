/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftObject } from "../odo";
import { OpenShiftItem } from './openshiftItem';
import * as vscode from 'vscode';
import * as validator from 'validator';
import { CliExitData } from "../cli";
import opn = require("opn");

export class Cluster extends OpenShiftItem {

    static async login(): Promise<string> {
        if (await Cluster.odo.requireLogin()) {
            return Cluster.loginDialog();
        } else {
            const value = await vscode.window.showInformationMessage(`You are already logged in the cluster. Do you want to login to a different cluster?`, 'Yes', 'No');
            if (value === 'Yes') {
                return Cluster.odo.execute(`odo logout`)
                .catch((error) => { return Promise.reject(`Failed to logout of the current cluster with '${error}'!`); })
                .then(async (result)=> {
                    if (result.stderr === "") {
                        return Cluster.loginDialog();
                    } else {
                        return Promise.reject(`Failed to logout of the current cluster with '${result.stderr}'!`);
                    }
                });
            }
            return Promise.resolve(null);
        }
    }

    static async logout(): Promise<string> {
        const value = await vscode.window.showWarningMessage(`Are you sure you want to logout of cluster`, 'Logout', 'Cancel');
        if (value === 'Logout') {
            return Cluster.odo.execute(`odo logout`).catch((error) => {
                return Promise.reject(`Failed to logout of the current cluster with '${error}'!`);
            }).then(async (result)=> {
                if (result.stderr === "") {
                    Cluster.explorer.refresh();
                    vscode.commands.executeCommand('setContext', 'isLoggedIn', false);
                    const logoutInfo = await vscode.window.showInformationMessage(`Successfully logged out. Do you want to login to a new cluster`, 'Yes', 'No');
                    if (logoutInfo === 'Yes') {
                        return Cluster.login();
                    } else {
                        return Promise.resolve(null);
                    }
                } else {
                    return Promise.reject(`Failed to logout of the current cluster with '${result.stderr}'!`);
                }
            });
        }
        return Promise.resolve(null);
    }

    static refresh(): void {
        Cluster.explorer.refresh();
    }

    static about(): void {
        Cluster.odo.executeInTerminal(`odo version`, process.cwd());
    }

    static async openshiftConsole(context: OpenShiftObject): Promise<void> {
        if (context) {
            opn(context.getName());
        } else {
            const result: OpenShiftObject[] = await Cluster.odo.getClusters();
            if(result.length>0 && result[0].getName().startsWith('http')) {
                opn(result[0].getName());
            } else {
                vscode.window.showErrorMessage(result[0].getName());
            }
        }
    }

    private static async loginDialog(): Promise<string> {
        const clusterURL = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: "Provide URL of the cluster to connect",
            validateInput: (value: string) => {
                if (!validator.isURL(value)) {
                    return 'Invalid URL provided';
                }
            }
        });
        if (!clusterURL) return Promise.resolve(null);
        const loginMethod = await vscode.window.showQuickPick(['Credentials', 'Token'], {placeHolder: 'Select the way to log in to the cluster.'});
        if (loginMethod === "Credentials") {
            return Cluster.credentialsLogin(clusterURL);
        } else {
            return Cluster.tokenLogin(clusterURL);
        }
    }

    private static async credentialsLogin(clusterURL: string): Promise<string> {
        const username = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: "Provide Username for basic authentication to the API server",
            validateInput: (value: string) => {
                if (validator.isEmpty(value.trim())) {
                    return 'Invalid Username';
                }
            }
        });
        if (!username) return Promise.resolve(null);
        const passwd  = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            password: true,
            prompt: "Provide Password for basic authentication to the API server"
        });
        if (!passwd) return Promise.resolve(null);
        return Promise.resolve()
            .then(() => Cluster.odo.execute(`odo login ${clusterURL} -u ${username} -p ${passwd}`))
            .then((result) => Cluster.loginMessage(clusterURL, result))
            .catch((error) => { return Promise.reject(`Failed to login to cluster '${clusterURL}' with '${error}'!`); });
    }

    private static async tokenLogin(clusterURL: string): Promise<string> {
        const ocToken = await vscode.window.showInputBox({
            prompt: "Provide Bearer token for authentication to the API server",
            ignoreFocusOut: true
        });
        if (!ocToken) return Promise.resolve(null);
        return Promise.resolve()
            .then(() => Cluster.odo.execute(`odo login ${clusterURL} --token=${ocToken}`))
            .then((result) => Cluster.loginMessage(clusterURL, result))
            .catch((error) => { return Promise.reject(`Failed to login to cluster '${clusterURL}' with '${error}'!`); });
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