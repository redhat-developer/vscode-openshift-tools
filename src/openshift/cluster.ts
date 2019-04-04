/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftObject, Command } from "../odo";
import { OpenShiftItem } from './openshiftItem';
import { window, commands, env } from 'vscode';
import { CliExitData, Cli } from "../cli";
import opn = require("opn");
import { TokenStore } from "../util/credentialManager";

export class Cluster extends OpenShiftItem {

    static async logout(): Promise<string> {
        const value = await window.showWarningMessage(`Do you want to logout of cluster?`, 'Logout', 'Cancel');
        if (value === 'Logout') {
            return Cluster.odo.execute(Command.odoLogout())
            .catch((error) => Promise.reject(`Failed to logout of the current cluster with '${error}'!`))
            .then(async (result) => {
                if (result.stderr === "") {
                    Cluster.explorer.refresh();
                    commands.executeCommand('setContext', 'isLoggedIn', false);
                    const logoutInfo = await window.showInformationMessage(`Successfully logged out. Do you want to login to a new cluster`, 'Yes', 'No');
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

    static async showOpenShiftOutput(): Promise<void> {
        Cli.getInstance().showOutputChannel();
    }

    static async openshiftConsole(context: OpenShiftObject): Promise<void> {
        if (context) {
            opn(`${context.getName()}/console`);
        } else {
            const result: OpenShiftObject[] = await Cluster.odo.getClusters();
            if (result.length>0 && result[0].getName().startsWith('http')) {
                opn(`${result[0].getName()}/console`);
            } else {
                window.showErrorMessage(result[0].getName());
            }
        }
    }

    static async getUrl(): Promise<string | null> {
        const clusterURl = await Cluster.getUrlFromClipboard();
        return await window.showInputBox({
            value: clusterURl,
            ignoreFocusOut: true,
            prompt: "Provide URL of the cluster to connect",
            validateInput: (value: string) => Cluster.validateUrl('Invalid URL provided', value)
        });
    }

    static async login(): Promise<string> {
        const response = await Cluster.requestLoginConfirmation();
        if (response !== 'Yes') return null;
        const loginMethod = await window.showQuickPick(['Credentials', 'Token'], {placeHolder: 'Select the way to log in to the cluster.'});
        if (!loginMethod) return null;
        if (loginMethod === "Credentials") {
            return Cluster.credentialsLogin(true);
        } else {
            return Cluster.tokenLogin(true);
        }
    }

    private static async requestLoginConfirmation(skipConfirmation: boolean = false): Promise<string> {
        let response = 'Yes';
        if (!skipConfirmation && !await Cluster.odo.requireLogin()) {
            response = await window.showInformationMessage(`You are already logged in the cluster. Do you want to login to a different cluster?`, 'Yes', 'No');
        }
        return response;
    }

    private static async save(username: string, password: string, checkpassword: string, result: CliExitData): Promise<CliExitData> {
        if (password === checkpassword) return result;
        const response = await window.showInformationMessage(`Do you want to save username and password?`, 'Yes', 'No');
        if (response === 'Yes') {
            await TokenStore.setUserName(username);
            await TokenStore.setItem('login', username, password);
        }
        return result;
    }

    static async credentialsLogin(skipConfirmation: boolean = false): Promise<string> {
        let password: string;
        const response = await Cluster.requestLoginConfirmation(skipConfirmation);
        if (response !== 'Yes') return null;
        const clusterURL = await Cluster.getUrl();
        if (!clusterURL) return null;
        const getUserName = await TokenStore.getUserName();
        const username = await window.showInputBox({
            ignoreFocusOut: true,
            prompt: "Provide Username for basic authentication to the API server",
            value: getUserName,
            validateInput: (value: string) => Cluster.emptyName('User name cannot be empty', value)
        });
        if (getUserName) password = await TokenStore.getItem('login', username);
        if (!username) return null;
        const passwd  = await window.showInputBox({
            ignoreFocusOut: true,
            password: true,
            prompt: "Provide Password for basic authentication to the API server",
            value: password
        });
        if (!passwd) return null;
        return Promise.resolve()
            .then(() => Cluster.odo.execute(Command.odoLoginWithUsernamePassword(clusterURL, username, passwd)))
            .then((result) => Cluster.save(username, passwd, password, result))
            .then((result) => Cluster.loginMessage(clusterURL, result))
            .catch((error) => Promise.reject(`Failed to login to cluster '${clusterURL}' with '${error}'!`));
    }

    static async readFromClipboard() {
        return await env.clipboard.readText();
    }

    static async getUrlFromClipboard() {
        const clipboard = await Cluster.readFromClipboard();
        if (await Cluster.ocLoginCommandMatches(clipboard)) return await Cluster.clusterURL(clipboard);
        return null;
    }

    static async tokenLogin(skipConfirmation: boolean = false): Promise<string> {
        let token: string;
        const response = await Cluster.requestLoginConfirmation(skipConfirmation);
        if (response !== 'Yes') return null;
        const clusterURL = await Cluster.getUrl();
        if (!clusterURL) return null;
        const clusterUrlFromClipboard = await Cluster.getUrlFromClipboard();
        if (clusterUrlFromClipboard === clusterURL.trim()) {
            token = Cluster.getToken(await Cluster.readFromClipboard());
        }
        const ocToken = await window.showInputBox({
            value: token,
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
            return commands.executeCommand('setContext', 'isLoggedIn', true)
                .then(() => `Successfully logged in to '${clusterURL}'`);
        } else {
            return Promise.reject(result.stderr);
        }
    }
}