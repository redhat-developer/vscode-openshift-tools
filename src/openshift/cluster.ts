/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window, commands, env, QuickPickItem, ExtensionContext, Terminal, Uri, workspace, WebviewPanel, Progress as VProgress, QuickInputButton, ThemeIcon, QuickPickItemButtonEvent } from 'vscode';
import { Command } from '../odo/command';
import OpenShiftItem, { clusterRequired } from './openshiftItem';
import { CliExitData, CliChannel } from '../cli';
import { TokenStore } from '../util/credentialManager';
import { KubeConfigUtils } from '../util/kubeUtils';
import { Filters } from '../util/filters';
import { Progress } from '../util/progress';
import { Platform } from '../util/platform';
import { WindowUtil } from '../util/windowUtils';
import { vsCommand, VsCommandError } from '../vscommand';
import ClusterViewLoader from '../webview/cluster/clusterViewLoader';
import { KubernetesObject } from '@kubernetes/client-node';

interface Versions {
    'openshift_version':  string;
    'kubernetes_version': string;
}

class quickBtn implements QuickInputButton {
    constructor(public iconPath: ThemeIcon, public tooltip: string) { }
}

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
                    void commands.executeCommand('setContext', 'isLoggedIn', false);
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

    static async getConsoleUrl(progress: VProgress<{increment: number, message: string}>): Promise<string> {
        let consoleUrl: string;
        try {
            progress.report({increment: 0, message: 'Detecting cluster type'});
            const getUrlObj = await Cluster.odo.execute(Command.showConsoleUrl());
            progress.report({increment: 30, message: 'Getting URL'});
            consoleUrl = JSON.parse(getUrlObj.stdout).data.consoleURL;
        } catch (ignore) {
            const serverUrl = await Cluster.odo.execute(Command.showServerUrl());
            consoleUrl = `${serverUrl.stdout}/console`;
        }
        return consoleUrl;
    }

    @vsCommand('openshift.open.developerConsole', true)
    @clusterRequired()
    static async openOpenshiftConsole(): Promise<void> {
        return Progress.execFunctionWithProgress('Opening Console Dashboard', async (progress) => {
            const consoleUrl = await Cluster.getConsoleUrl(progress);
            progress.report({increment: 100, message: 'Starting default browser'});
            return commands.executeCommand('vscode.open', Uri.parse(consoleUrl));
        });
    }

    @vsCommand('openshift.resource.openInDeveloperConsole')
    @clusterRequired()
    static async openInDeveloperConsole(resource: KubernetesObject): Promise<void> {
        return Progress.execFunctionWithProgress('Opening Console Dashboard', async (progress) => {
            const consoleUrl = await Cluster.getConsoleUrl(progress);
            progress.report({increment: 100, message: 'Starting default browser'});
            return commands.executeCommand('vscode.open', Uri.parse(`${consoleUrl}/topology/ns/${resource.metadata.namespace}?selectId=${resource.metadata.uid}&view=graph`));
        });
    }

    @vsCommand('openshift.explorer.switchContext')
    static async switchContext(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const k8sConfig = new KubeConfigUtils();
            const contexts = k8sConfig.contexts.filter((item) => item.name !== k8sConfig.currentContext);
            const deleteBtn = new quickBtn(new ThemeIcon('trash'), 'Delete');
            const quickPick = window.createQuickPick();
            const contextNames: QuickPickItem[] = contexts.map((ctx) => ({ label: `${ctx.name}`, buttons: [deleteBtn] }));
            quickPick.items = contextNames;
            if (contextNames.length === 0) {
                void window.showInformationMessage('You have no Kubernetes contexts yet, please login to a cluster.', 'Login', 'Cancel')
                    .then((command: string) => {
                        if (command === 'Login') {
                            resolve(Cluster.login(undefined, true));
                        }
                        resolve(null);
                    })
            } else {
                let selection: readonly QuickPickItem[] | undefined;
                const hideDisposable = quickPick.onDidHide(() => resolve(null));
                quickPick.onDidChangeSelection((selects) => {
                    selection = selects;
                });
                quickPick.onDidAccept(() => {
                    const choice = selection[0];
                    hideDisposable.dispose();
                    quickPick.hide();
                    Cluster.odo.execute(Command.setOpenshiftContext(choice.label))
                        .then(() => resolve(`Cluster context is changed to: ${choice.label}.`))
                        .catch(reject);
                });
                quickPick.onDidTriggerItemButton(async (event: QuickPickItemButtonEvent<QuickPickItem>) => {
                    const answer = await window.showInformationMessage(`Do you want to delete '${event.item.label}' Context from Kubernetes configuration?`, 'Yes', 'No');
                    if (answer === 'Yes') {
                        const context = k8sConfig.getContextObject(event.item.label);
                        const index = contexts.indexOf(context);
                        if (index > -1) {
                            CliChannel.getInstance().executeTool(Command.deleteContext(context.name))
                                .then(() => resolve(`Context ${context.name} deleted.`))
                                .catch(reject);
                        }
                    }
                });
                quickPick.show();
            }
        });
    }

    static async getUrl(): Promise<string | null> {
        const clusterURl = await Cluster.getUrlFromClipboard();
        return await Cluster.showQuickPick(clusterURl);
    }

    private static async showQuickPick(clusterURl: string): Promise<string> {
        return new Promise<string | null>((resolve, reject) => {
            const k8sConfig = new KubeConfigUtils();
            const deleteBtn = new quickBtn(new ThemeIcon('trash'), 'Delete');
            const createUrl: QuickPickItem = { label: '$(plus) Provide new URL...' };
            const clusterItems = k8sConfig.getServers();
            const quickPick = window.createQuickPick();
            const contextNames: QuickPickItem[] = clusterItems.map((ctx) => ({ ...ctx, buttons: ctx.description ? [] : [deleteBtn] }));
            quickPick.items = [createUrl, ...contextNames];
            let selection: readonly QuickPickItem[] | undefined;
            const hideDisposable = quickPick.onDidHide(() => resolve(null));
            quickPick.onDidAccept(() => {
                const choice = selection[0];
                hideDisposable.dispose();
                quickPick.hide();
                if (choice.label === createUrl.label) {
                    resolve(window.showInputBox({
                        value: clusterURl,
                        ignoreFocusOut: true,
                        prompt: 'Provide new Cluster URL to connect',
                        validateInput: (value: string) => Cluster.validateUrl('Invalid URL provided', value)
                    }));
                } else {
                    resolve(choice.label);
                }
            });
            quickPick.onDidChangeSelection((selects) => {
                selection = selects;
            });
            quickPick.onDidTriggerItemButton(async (event) => {
                const answer = await window.showInformationMessage('Are you sure want to delete the Cluster?', 'Yes', 'No')
                if (answer === 'Yes') {
                    const contexts = k8sConfig.contexts.filter((item) => item.name !== k8sConfig.currentContext);
                    const cluster = k8sConfig.getClusters().filter((kubeConfigCluster) => kubeConfigCluster.server === event.item.label).pop();
                    const context = k8sConfig.getContexts().filter((kubeContext) => kubeContext.cluster === cluster.name).pop();
                    if (context) {
                        const index = contexts.indexOf(context);
                        if (index < 0) {
                            void window.showErrorMessage(`Unable to delete cluster ${cluster.server} which mapped as current context`);
                            return;
                        }
                        await CliChannel.getInstance().executeTool(Command.deleteContext(context.name));
                        const user = k8sConfig.getUsers().filter((confUser) => confUser.name === context.user).pop();
                        await CliChannel.getInstance().executeTool(Command.deleteUser(user.name));
                        CliChannel.getInstance().executeTool(Command.deleteCluster(cluster.name)).then(() => resolve('')).catch((reject));
                    }
                }
            });
            quickPick.show();
        });
    }

    @vsCommand('openshift.explorer.addCluster')
    static async add(value: string): Promise<void> {
        const webViewPanel: WebviewPanel = await ClusterViewLoader.loadView('Add OpenShift Cluster');
        if(value?.length > 0){
            await webViewPanel.webview.postMessage({action: 'cluster', param: value});
        }
    }

    @vsCommand('openshift.explorer.stopCluster')
    static async stop(): Promise<void> {
        let pathSelectionDialog;
        let newPathPrompt;
        let crcBinary;
        const crcPath = workspace.getConfiguration('openshiftToolkit').get('crcBinaryLocation');
        if(crcPath) {
            newPathPrompt = { label: '$(plus) Provide different OpenShift Local file path'};
            pathSelectionDialog = await window.showQuickPick([{label:`${crcPath}`, description: 'Fetched from settings'}, newPathPrompt], {placeHolder: 'Select OpenShift Local file path', ignoreFocusOut: true});
        }
        if(!pathSelectionDialog) return;
        if (pathSelectionDialog.label === newPathPrompt.label) {
            const crcBinaryLocation = await window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                defaultUri: Uri.file(Platform.getUserHomePath()),
                openLabel: 'Add OpenShift Local file path.',
            });
            if (!crcBinaryLocation) return null;
            crcBinary = crcBinaryLocation[0].fsPath;
        } else {
            crcBinary = crcPath;
        }
        const terminal: Terminal = WindowUtil.createTerminal('OpenShift: Stop OpenShift Local', undefined);
            terminal.sendText(`${crcBinary} stop`);
            terminal.show();
        return;
    }

    public static async getVersions(): Promise<Versions> {
        const result = await Cluster.odo.execute(Command.printOcVersionJson(), undefined, false);
        const versions: Versions = {
            'kubernetes_version': undefined,
            'openshift_version': undefined
        };
        if (!result.error) {
            try {
                // try to fetch versions for stdout
                const versionsJson = JSON.parse(result.stdout);
                if (versionsJson?.serverVersion?.major && versionsJson?.serverVersion?.minor) {
                    // eslint-disable-next-line camelcase
                    versions.kubernetes_version = `${versionsJson.serverVersion.major}.${versionsJson.serverVersion.minor}`;
                }
                if (versionsJson?.openshiftVersion) {
                    // eslint-disable-next-line camelcase
                    versions.openshift_version = versionsJson.openshiftVersion;
                }

            } catch(err) {
                // ignore and return undefined
            }
        }
        return versions;
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
        let result:any = loginActionSelected.label === 'Credentials' ? await Cluster.credentialsLogin(true, clusterURL) : await Cluster.tokenLogin(clusterURL, true);
        if (result) {
            const versions = await Cluster.getVersions();
            if (versions) {
                result = new String(result);
                // get cluster information using 'oc version'
                result.properties = versions;
            }
        }
        return result;
    }

    private static async requestLoginConfirmation(skipConfirmation = false): Promise<string> {
        let response = 'Yes';
        if (!skipConfirmation && !await Cluster.odo.requireLogin()) {
            const cluster = new KubeConfigUtils().getCurrentCluster();
            response = await window.showInformationMessage(`You are already logged into ${cluster.server} cluster. Do you want to login to a different cluster?`, 'Yes', 'No');
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
            if (error instanceof VsCommandError) {
                throw new VsCommandError(`Failed to login to cluster '${clusterURL}' with '${Filters.filterPassword(error.message)}'!`, `Failed to login to cluster. ${error.telemetryMessage}`);
            } else {
                throw new VsCommandError(`Failed to login to cluster '${clusterURL}' with '${Filters.filterPassword(error.message)}'!`, 'Failed to login to cluster');
            }
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
    static async tokenLogin(userClusterUrl: string, skipConfirmation = false, userToken?: string): Promise<string | null> {
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

        let ocToken: string;
        if (!userToken) {
            ocToken = await window.showInputBox({
                value: token,
                prompt: 'Provide Bearer token for authentication to the API server',
                ignoreFocusOut: true,
                password: true
            });
            if (!ocToken) return null;
        } else {
            ocToken = userToken;
        }
        return Progress.execFunctionWithProgress(`Login to the cluster: ${clusterURL}`,
            () => Cluster.odo.execute(Command.odoLoginWithToken(clusterURL, ocToken.trim()))
            .then((result) => Cluster.loginMessage(clusterURL, result))
            .catch((error) => Promise.reject(new VsCommandError(`Failed to login to cluster '${clusterURL}' with '${Filters.filterToken(error.message)}'!`, 'Failed to login to cluster')))
        );
    }

    @vsCommand('openshift.explorer.login.clipboard')
    static async loginUsingClipboardToken(apiEndpointUrl: string, oauthRequestTokenUrl: string): Promise<string | null> {
        const clipboard = await Cluster.readFromClipboard();
        if(!clipboard) {
            const choice = await window.showErrorMessage('Cannot parse token in clipboard. Please click `Get token` button below, copy token into clipboard and press `Login to Sandbox` button again.',
                'Get token');
            if (choice === 'Get token') {
                await commands.executeCommand('vscode.open', Uri.parse(oauthRequestTokenUrl));
            }
            return;
        }
        return Cluster.tokenLogin(apiEndpointUrl, true, clipboard);
    }

    static async loginUsingClipboardInfo(dashboardUrl: string): Promise<string | null> {
        const clipboard = await Cluster.readFromClipboard();
        if(!Cluster.ocLoginCommandMatches(clipboard)) {
            const choice = await window.showErrorMessage('Cannot parse login command in clipboard. Please open cluster dashboard and select `Copy login command` from user name dropdown in the upper right corner. Copy full login command to clipboard. Switch back to VSCode window and press `Login to Sandbox` button again.',
                'Open Dashboard');
            if (choice === 'Open Dashboard') {
                await commands.executeCommand('vscode.open', Uri.parse(dashboardUrl));
            }
            return;
        }
        const url = Cluster.clusterURL(clipboard);
        const token = Cluster.getToken(clipboard);
        return Cluster.tokenLogin(url, true, token);
    }

    static async loginMessage(clusterURL: string, result: CliExitData): Promise<string | undefined> {
        if (result.stderr === '') {
            Cluster.explorer.refresh();
            await commands.executeCommand('setContext', 'isLoggedIn', true);
            return `Successfully logged in to '${clusterURL}'`;
        }
        throw new VsCommandError(result.stderr, 'Failed to login to cluster with output in stderr');
    }
}
