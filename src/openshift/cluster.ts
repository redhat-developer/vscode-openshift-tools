/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window, commands, env, QuickPickItem, ExtensionContext, Uri } from 'vscode';
import { Command } from "../odo/command";
import OpenShiftItem from './openshiftItem';
import { CliExitData, CliChannel } from "../cli";
import { TokenStore } from "../util/credentialManager";
import { KubeConfigUtils } from '../util/kubeUtils';
import { Filters } from "../util/filters";
import { Progress } from "../util/progress";
import { vsCommand, VsCommandError } from '../vscommand';
import ClusterViewLoader from '../view/cluster/clusterViewLoader';

export class Cluster extends OpenShiftItem {
    public static extensionContext: ExtensionContext;

    @vsCommand('openshift.explorer.logout')
    static async logout(): Promise<string> {
        const value = await window.showWarningMessage(`Do you want to logout of cluster?`, 'Logout', 'Cancel');
        if (value === 'Logout') {
            return Cluster.odo.execute(Command.odoLogout())
            .catch((error) => Promise.reject(new VsCommandError(`Failed to logout of the current cluster with '${error}'!`)))
            .then(async (result) => {
                if (result.stderr === "") {
                    Cluster.explorer.refresh();
                    commands.executeCommand('setContext', 'isLoggedIn', false);
                    const logoutInfo = await window.showInformationMessage(`Successfully logged out. Do you want to login to a new cluster`, 'Yes', 'No');
                    if (logoutInfo === 'Yes') {
                        return Cluster.login();
                    }
                    return null;
                }
                throw new VsCommandError(`Failed to logout of the current cluster with '${result.stderr}'!`);
            });
        }
        return null;
    }

    @vsCommand('openshift.explorer.refresh')
    static refresh(): void {
        Cluster.explorer.refresh();
    }

    @vsCommand('openshift.about')
    static async about(): Promise<void> {
        await Cluster.odo.executeInTerminal(Command.printOdoVersion(), undefined, 'OpenShift: Show odo Version');
    }

    @vsCommand('openshift.oc.about')
    static async ocAbout(): Promise<void> {
        await Cluster.odo.executeInTerminal(Command.printOcVersion(), undefined, 'OpenShift: Show OKD CLI Tool Version');
    }

    @vsCommand('openshift.output')
    static showOpenShiftOutput(): void {
        CliChannel.getInstance().showOutput();
    }

    @vsCommand('openshift.openshiftConsole', true)
    static async openshiftConsole(): Promise<void> {
        let consoleUrl: string;
        try {
            const getUrlObj = await Cluster.odo.execute(Command.showConsoleUrl());
            consoleUrl = JSON.parse(getUrlObj.stdout).data.consoleURL;
        } catch (ignore) {
            const serverUrl = await Cluster.odo.execute(Command.showServerUrl());
            consoleUrl = `${serverUrl.stdout}/console`;
        }
        return commands.executeCommand('vscode.open', Uri.parse(consoleUrl));
    }

    @vsCommand('openshift.explorer.switchContext')
    static async switchContext(): Promise<string> {
        const k8sConfig = new KubeConfigUtils();
        const contexts = k8sConfig.contexts.filter((item) => item.name !== k8sConfig.currentContext);
        const contextName: QuickPickItem[] = contexts.map((ctx) => ({ label: `${ctx.name}`}));
        const choice = await window.showQuickPick(contextName, {placeHolder: "Select a new OpenShift context"});
        if (!choice) return null;
        await Cluster.odo.execute(Command.setOpenshiftContext(choice.label));
        return `Cluster context is changed to: ${choice.label}`;
    }

    static async getUrl(): Promise<string | null> {
        const k8sConfig = new KubeConfigUtils();
        const clusterURl = await Cluster.getUrlFromClipboard();
        const createUrl: QuickPickItem = { label: `$(plus) Provide new URL...`};
        const clusterItems = k8sConfig.getServers();
        const choice = await window.showQuickPick([createUrl, ...clusterItems], {placeHolder: "Provide Cluster URL to connect", ignoreFocusOut: true});
        if (!choice) return null;
        return (choice.label === createUrl.label) ?
            window.showInputBox({
                value: clusterURl,
                ignoreFocusOut: true,
                prompt: "Provide new Cluster URL to connect",
                validateInput: (value: string) => Cluster.validateUrl('Invalid URL provided', value)
            }) : choice.label;
    }

    @vsCommand('openshift.explorer.addCluster')
    static add(): Promise<any> {
        ClusterViewLoader.loadView(`Add OpenShift Cluster`);
        return;
    }

    @vsCommand('openshift.explorer.login')
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
        const loginActionSelected = await window.showQuickPick(loginActions, {placeHolder: 'Select a way to log in to the cluster.', ignoreFocusOut: true});
        if (!loginActionSelected) return null;
        return loginActionSelected.label === 'Credentials' ? Cluster.credentialsLogin(true) : Cluster.tokenLogin(true);
    }

    private static async requestLoginConfirmation(skipConfirmation = false): Promise<string> {
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

    @vsCommand('openshift.explorer.login.credentialsLogin')
    static async credentialsLogin(skipConfirmation = false): Promise<string> {
        let password: string;
        const response = await Cluster.requestLoginConfirmation(skipConfirmation);

        if (response !== 'Yes') return null;

        const clusterURL = await Cluster.getUrl();

        if (!clusterURL) return null;

        const getUserName = await TokenStore.getUserName();
        const k8sConfig = new KubeConfigUtils();
        const users = k8sConfig.getClusterUsers(clusterURL);
        const addUser: QuickPickItem = { label: `$(plus) Add new user...`};
        const choice = await window.showQuickPick([addUser, ...users], {placeHolder: "Select username for basic authentication to the API server", ignoreFocusOut: true});

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

        return Progress.execFunctionWithProgress(`Login to the cluster: ${clusterURL}`,
            () => Cluster.odo.execute(Command.odoLoginWithUsernamePassword(clusterURL, username, passwd))
            .then((result) => Cluster.save(username, passwd, password, result))
            .then((result) => Cluster.loginMessage(clusterURL, result))
            .catch((error) => Promise.reject(new VsCommandError(`Failed to login to cluster '${clusterURL}' with '${Filters.filterPassword(error.message)}'!`)))
        );
    }

    static async readFromClipboard(): Promise<string> {
        let r = "";
        try {
            r = await env.clipboard.readText();
        } catch (ignore) {
            // ignore exceptions and return empty string
        }
        return r;
    }

    static async getUrlFromClipboard(): Promise<string | null> {
        const clipboard = await Cluster.readFromClipboard();
        if (Cluster.ocLoginCommandMatches(clipboard)) return Cluster.clusterURL(clipboard);
        return null;
    }

    @vsCommand('openshift.explorer.login.tokenLogin')
    static async tokenLogin(skipConfirmation = false): Promise<string | null> {
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
        return Progress.execFunctionWithProgress(`Login to the cluster: ${clusterURL}`,
            () => Cluster.odo.execute(Command.odoLoginWithToken(clusterURL, ocToken))
            .then((result) => Cluster.loginMessage(clusterURL, result))
            .catch((error) => Promise.reject(new VsCommandError(`Failed to login to cluster '${clusterURL}' with '${Filters.filterToken(error.message)}'!`)))
        );
    }

    private static async loginMessage(clusterURL: string, result: CliExitData): Promise<string | undefined> {
        if (result.stderr === "") {
            Cluster.explorer.refresh();
            await commands.executeCommand('setContext', 'isLoggedIn', true);
            return `Successfully logged in to '${clusterURL}'`;
        }
        throw new VsCommandError(result.stderr);
    }
}
