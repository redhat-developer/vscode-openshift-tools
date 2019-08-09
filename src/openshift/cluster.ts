/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Command } from "../odo";
import { OpenShiftItem } from './openshiftItem';
import { window, commands, env, QuickPickItem } from 'vscode';
import { CliExitData, Cli } from "../cli";
import open = require("open");
import { TokenStore } from "../util/credentialManager";
import { KubeConfigUtils } from '../util/kubeUtils';
import { Filters } from "../util/filters";

class CreateUrlItem implements QuickPickItem {

	constructor() { }

	get label(): string { return `$(plus) Provide new URL...`; }
    get description(): string { return ''; }

}

class CreateUserItem implements QuickPickItem {

	constructor() { }

	get label(): string { return `$(plus) Add new user...`; }
    get description(): string { return ''; }

}
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

    static async openshiftConsole(): Promise<void> {
        let consoleUrl: string;
        const versionInfo = await Cluster.odo.execute(Command.getclusterVersion(), process.cwd(), false);
        if (versionInfo.error === null) {
            const routeObj = await Cluster.odo.execute(Command.getOpenshiftClusterRoute());
            const spec = JSON.parse(routeObj.stdout).items[0].spec;
            consoleUrl = `${spec.port.targetPort}://${spec.host}`;
        } else {
            const serverUrl = await Cluster.odo.execute(Command.showServerUrl());
            consoleUrl = `${serverUrl.stdout}/console`;
        }
        open(consoleUrl);
    }

    static async switchContext() {
        const k8sConfig = new KubeConfigUtils();
        const contexts = k8sConfig.contexts.filter((item) => item.name !== k8sConfig.currentContext);
        const contextName: QuickPickItem[] = contexts.map((ctx) => ({ label: `$(code)  ${ctx.name}`}));
        const choice = await window.showQuickPick(contextName, {placeHolder: "Select the new context"});
        if (!choice) return null;
        return Promise.resolve()
            .then(() => Cluster.odo.execute(Command.setContext(choice.label)))
            .then(() => window.showInformationMessage(`Cluster context is changed to: ${choice.label}`));
    }

    static async getUrl(): Promise<string | null> {
        const k8sConfig = new KubeConfigUtils();
        const clusterURl = await Cluster.getUrlFromClipboard();
        const createUrl = new CreateUrlItem();
        const clusterItems = await k8sConfig.getServers();
        const choice = await window.showQuickPick([createUrl, ...clusterItems], {placeHolder: "Provide Cluster URL to connect"});
        if (!choice) return null;
        return (choice.label === createUrl.label) ?
            await window.showInputBox({
                value: clusterURl,
                ignoreFocusOut: true,
                prompt: "Provide new Cluster URL to connect",
                validateInput: (value: string) => Cluster.validateUrl('Invalid URL provided', value)
            }) : choice.label;
    }

    static async login(): Promise<string> {
        const response = await Cluster.requestLoginConfirmation();
        const loginActions = [
            {
                label: 'Credentials',
                description: 'Log in to the given server using credentials'
            },
            {
                label: 'Token',
                description: 'Log in to the given server using bearer token'
            }
        ];
        if (response !== 'Yes') return null;
        const loginActionSelected = await window.showQuickPick(loginActions, {placeHolder: 'Select the way to log in to the cluster.'});
        if (!loginActionSelected) return null;
        return loginActionSelected.label === 'Credentials' ? Cluster.credentialsLogin(true) : Cluster.tokenLogin(true);
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
        const k8sConfig = new KubeConfigUtils();
        const users = await k8sConfig.getClusterUsers(clusterURL);
        const addUser = new CreateUserItem();
        const choice = await window.showQuickPick([addUser, ...users], {placeHolder: "Select username for basic authentication to the API server"});

        if (!choice) return null;

        const username =  (choice.label === addUser.label) ?
            await window.showInputBox({
                ignoreFocusOut: true,
                prompt: "Provide Username for basic authentication to the API server",
                value: "",
                validateInput: (value: string) => Cluster.emptyName('User name cannot be empty', value)
            }) : choice.label;

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
            .catch((error) => Promise.reject(new Error(`Failed to login to cluster '${clusterURL}' with '${Filters.filterPassword(error.message)}'!`)));
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
            ignoreFocusOut: true,
            password: true
        });
        if (!ocToken) return null;
        return Promise.resolve()
            .then(() => Cluster.odo.execute(Command.odoLoginWithToken(clusterURL, ocToken)))
            .then((result) => Cluster.loginMessage(clusterURL, result))
            .catch((error) => Promise.reject(new Error(`Failed to login to cluster '${clusterURL}' with '${Filters.filterToken(error.message)}'!`)));
    }

    private static async loginMessage(clusterURL: string, result: CliExitData): Promise<string> {
        if (result.stderr === "") {
            Cluster.explorer.refresh();
            return commands.executeCommand('setContext', 'isLoggedIn', true)
                .then(() => `Successfully logged in to '${clusterURL}'`);
        } else {
            throw new Error(result.stderr);
        }
    }
}
