/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window, commands, env, QuickPickItem, ExtensionContext, Terminal, Uri, workspace } from 'vscode';
import { Command } from '../odo/command';
import OpenShiftItem from './openshiftItem';
import { CliExitData, CliChannel } from '../cli';
import { TokenStore } from '../util/credentialManager';
import { KubeConfigUtils } from '../util/kubeUtils';
import { Filters } from '../util/filters';
import { Progress } from '../util/progress';
import { Platform } from '../util/platform';
import { WindowUtil } from '../util/windowUtils';
import { vsCommand, VsCommandError } from '../vscommand';
import ClusterViewLoader from '../view/cluster/clusterViewLoader';

export class Cluster extends OpenShiftItem {
    public static extensionContext: ExtensionContext;

    @vsCommand('openshift.explorer.logout')
    static async logout(): Promise<string> {
        const value = await window.showWarningMessage('Do you want to logout of cluster?', 'Logout', 'Cancel');
        if (value === 'Logout') {
            return Cluster.odo.execute(Command.odoLogout())
            .catch((error) => Promise.reject(new VsCommandError(`Failed to logout of the current cluster with '${error}'!`, 'Failed to logout of the current cluster')))
            .then(async (result) => {
                if (result.stderr === '') {
                    Cluster.explorer.refresh();
                    commands.executeCommand('setContext', 'isLoggedIn', false);
                    const logoutInfo = await window.showInformationMessage('Successfully logged out. Do you want to login to a new cluster', 'Yes', 'No');
                    if (logoutInfo === 'Yes') {
                        return Cluster.login(undefined, true);
                    }
                    return null;
                }
                throw new VsCommandError(`Failed to logout of the current cluster with '${result.stderr}'!`, 'Failed to logout of the current cluster');
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
        const choice = await window.showQuickPick(contextName, {placeHolder: 'Select a new OpenShift context'});
        if (!choice) return null;
        await Cluster.odo.execute(Command.setOpenshiftContext(choice.label));
        return `Cluster context is changed to: ${choice.label}`;
    }

    static async getUrl(): Promise<string | null> {
        const k8sConfig = new KubeConfigUtils();
        const clusterURl = await Cluster.getUrlFromClipboard();
        const createUrl: QuickPickItem = { label: '$(plus) Provide new URL...'};
        const clusterItems = k8sConfig.getServers();
        const choice = await window.showQuickPick([createUrl, ...clusterItems], {placeHolder: 'Provide Cluster URL to connect', ignoreFocusOut: true});
        if (!choice) return null;
        return (choice.label === createUrl.label) ?
            window.showInputBox({
                value: clusterURl,
                ignoreFocusOut: true,
                prompt: 'Provide new Cluster URL to connect',
                validateInput: (value: string) => Cluster.validateUrl('Invalid URL provided', value)
            }) : choice.label;
    }

    @vsCommand('openshift.explorer.addCluster')
    static add(): void {
        ClusterViewLoader.loadView('Add OpenShift Cluster');
    }

    @vsCommand('openshift.explorer.stopCluster')
    static async stop(): Promise<void> {
        let pathSelectionDialog;
        let newPathPrompt;
        let crcBinary;
        const crcPath = workspace.getConfiguration('openshiftConnector').get('crcBinaryLocation');
        if(crcPath) {
            newPathPrompt = { label: '$(plus) Provide different crc binary path'};
            pathSelectionDialog = await window.showQuickPick([{label:`${crcPath}`, description: 'Fetched from settings'}, newPathPrompt], {placeHolder: 'Select CRC binary path', ignoreFocusOut: true});
        }
        if(!pathSelectionDialog) return;
        if (pathSelectionDialog.label === newPathPrompt.label) {
            const crcBinaryLocation = await window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                defaultUri: Uri.file(Platform.getUserHomePath()),
                openLabel: 'Add crc binary path.',
            });
            if (!crcBinaryLocation) return null;
            crcBinary = crcBinaryLocation[0].fsPath;
        } else {
            crcBinary = crcPath;
        }
        const terminal: Terminal = WindowUtil.createTerminal('OpenShift: Stop CRC', undefined);
            terminal.sendText(`${crcBinary} stop`);
            terminal.show();
        return;
    }

    @vsCommand('openshift.explorer.login')
    static async login(context?: any, skipConfirmation = false): Promise<string> {
        const response = await Cluster.requestLoginConfirmation(skipConfirmation);

        if (response !== 'Yes') return null;

        const clusterURL = await Cluster.getUrl();

        if (!clusterURL) return null;

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
        const loginActionSelected = await window.showQuickPick(loginActions, {placeHolder: 'Select a way to log in to the cluster.', ignoreFocusOut: true});
        if (!loginActionSelected) return null;
        return loginActionSelected.label === 'Credentials' ? Cluster.credentialsLogin(true, clusterURL) : Cluster.tokenLogin(clusterURL, true);
    }

    private static async requestLoginConfirmation(skipConfirmation = false): Promise<string> {
        let response = 'Yes';
        if (!skipConfirmation && !await Cluster.odo.requireLogin()) {
            response = await window.showInformationMessage('You are already logged in the cluster. Do you want to login to a different cluster?', 'Yes', 'No');
        }
        return response;
    }

    private static async save(username: string, password: string, checkpassword: string, result: CliExitData): Promise<CliExitData> {
        if (password === checkpassword) return result;
        const response = await window.showInformationMessage('Do you want to save username and password?', 'Yes', 'No');
        if (response === 'Yes') {
            await TokenStore.setUserName(username);
            await TokenStore.setItem('login', username, password);
        }
        return result;
    }

    @vsCommand('openshift.explorer.login.credentialsLogin')
    static async credentialsLogin(skipConfirmation = false, userClusterUrl?: string, userName?: string, userPassword?: string): Promise<string> {
        let password: string;
        const response = await Cluster.requestLoginConfirmation(skipConfirmation);

        if (response !== 'Yes') return null;

        let clusterURL = userClusterUrl;
        if (!clusterURL) {
            clusterURL = await Cluster.getUrl();
        }

        if (!clusterURL) return null;

        let username = userName;
        const getUserName = await TokenStore.getUserName();

        if (!username)  {
            const k8sConfig = new KubeConfigUtils();
            const users = k8sConfig.getClusterUsers(clusterURL);
            const addUser: QuickPickItem = { label: '$(plus) Add new user...'};
            const choice = await window.showQuickPick([addUser, ...users], {placeHolder: 'Select username for basic authentication to the API server', ignoreFocusOut: true});

            if (!choice) return null;

            if (choice.label === addUser.label) {
                username = await window.showInputBox({
                    ignoreFocusOut: true,
                    prompt: 'Provide Username for basic authentication to the API server',
                    value: '',
                    validateInput: (value: string) => Cluster.emptyName('User name cannot be empty', value)
                })
            } else {
                username = choice.label;
            }
        }

        if (!username) return null;

        if (getUserName) password = await TokenStore.getItem('login', username);

        let passwd = userPassword;
        if (!passwd) {
            passwd = await window.showInputBox({
                ignoreFocusOut: true,
                password: true,
                prompt: 'Provide Password for basic authentication to the API server',
                value: password
            });
        }

        if (!passwd) return null;

        try {
            const result = await Progress.execFunctionWithProgress(
                `Login to the cluster: ${clusterURL}`,
                () => Cluster.odo.execute(Command.odoLoginWithUsernamePassword(clusterURL, username, passwd)));
            await Cluster.save(username, passwd, password, result);
            return await Cluster.loginMessage(clusterURL, result);
        } catch (error) {
            throw new VsCommandError(`Failed to login to cluster '${clusterURL}' with '${Filters.filterPassword(error.message)}'!`, 'Failed to login to cluster');
        }
    }

    static async readFromClipboard(): Promise<string> {
        let r = '';
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
    static async tokenLogin(userClusterUrl: string, skipConfirmation = false): Promise<string | null> {
        let token: string;
        const response = await Cluster.requestLoginConfirmation(skipConfirmation);

        if (response !== 'Yes') return null;

        let clusterURL = userClusterUrl;
        let clusterUrlFromClipboard: string;

        if (!clusterURL) {
            clusterUrlFromClipboard = await Cluster.getUrlFromClipboard();
        }

        if (!clusterURL && clusterUrlFromClipboard || clusterURL?.trim() === clusterUrlFromClipboard) {
            token = Cluster.getToken(await Cluster.readFromClipboard());
            clusterURL = clusterUrlFromClipboard;
        }

        if (!clusterURL) {
            clusterURL = await Cluster.getUrl();
        }

        const ocToken = await window.showInputBox({
            value: token,
            prompt: 'Provide Bearer token for authentication to the API server',
            ignoreFocusOut: true,
            password: true
        });
        if (!ocToken) return null;

        return Progress.execFunctionWithProgress(`Login to the cluster: ${clusterURL}`,
            () => Cluster.odo.execute(Command.odoLoginWithToken(clusterURL, ocToken.trim()))
            .then((result) => Cluster.loginMessage(clusterURL, result))
            .catch((error) => Promise.reject(new VsCommandError(`Failed to login to cluster '${clusterURL}' with '${Filters.filterToken(error.message)}'!`, 'Failed to login to cluster')))
        );
    }

    static async loginMessage(clusterURL: string, result: CliExitData): Promise<string | undefined> {
        if (result.stderr === '') {
            Cluster.explorer.refresh();
            await commands.executeCommand('setContext', 'isLoggedIn', true);
            return `Successfully logged in to '${clusterURL}'`;
        }
        throw new VsCommandError(result.stderr, 'Failed to login to cluster with output in stderror');
    }
}
