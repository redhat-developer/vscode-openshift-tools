/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubernetesObject } from '@kubernetes/client-node';
import { ExtensionContext, QuickInputButtons, QuickPickItem, QuickPickItemButtonEvent, ThemeIcon, Uri, commands, env, window, workspace } from 'vscode';
import { CommandText } from '../base/command';
import { CliChannel } from '../cli';
import { OpenShiftExplorer } from '../explorer';
import { Oc } from '../oc/ocWrapper';
import { Command } from '../odo/command';
import { Odo } from '../odo/odoWrapper';
import * as NameValidator from '../openshift/nameValidator';
import { TokenStore } from '../util/credentialManager';
import { Filters } from '../util/filters';
import { inputValue, quickBtn } from '../util/inputValue';
import { KubeConfigUtils } from '../util/kubeUtils';
import { LoginUtil } from '../util/loginUtil';
import { Platform } from '../util/platform';
import { Progress } from '../util/progress';
import { VsCommandError, vsCommand } from '../vscommand';
import { OpenShiftTerminalManager } from '../webview/openshift-terminal/openShiftTerminal';
import OpenShiftItem, { clusterRequired } from './openshiftItem';
import fetch = require('make-fetch-happen');
import { Cluster as KcuCluster } from '@kubernetes/client-node/dist/config_types';

export class Cluster extends OpenShiftItem {

    public static extensionContext: ExtensionContext;

    @vsCommand('openshift.explorer.logout')
    static async logout(): Promise<string> {
        const value = await window.showWarningMessage(
            'Do you want to logout of cluster?',
            'Logout',
            'Cancel',
        );
        if (value === 'Logout') {
            return Oc.Instance.logout()
                .catch(async (error) =>
                    Promise.reject(
                        new VsCommandError(
                         `Failed to logout of the current cluster with '${error}'!`,
                            'Failed to logout of the current cluster',
                        ),
                    ),
                )
                .then(async () => {
                    OpenShiftExplorer.getInstance().refresh();
                    Cluster.serverlessView.refresh();
                    void commands.executeCommand('setContext', 'isLoggedIn', false);
                    const logoutInfo = await window.showInformationMessage(
                        'Successfully logged out. Do you want to login to a new cluster',
                        'Yes',
                        'No',
                    );
                    if (logoutInfo === 'Yes') {
                        return Cluster.login(undefined, true);
                    }
                    return null;
                });
        }
        return null;
    }

    @vsCommand('openshift.explorer.refresh')
    static refresh(): void {
        OpenShiftExplorer.getInstance().refresh();
        Cluster.serverlessView.refresh();
    }

    @vsCommand('openshift.about')
    static async about(): Promise<void> {
        await OpenShiftTerminalManager.getInstance().executeInTerminal(Command.printOdoVersion(), undefined, 'Show odo Version');
    }

    @vsCommand('openshift.oc.about')
    static async ocAbout(): Promise<void> {
        await OpenShiftTerminalManager.getInstance().executeInTerminal(new CommandText('oc', 'version'), undefined, 'Show OKD CLI Tool Version');
    }

    @vsCommand('openshift.output')
    static showOpenShiftOutput(): void {
        CliChannel.getInstance().showOutput();
    }

    @vsCommand('openshift.open.developerConsole', true)
    @clusterRequired()
    static async openOpenshiftConsole(): Promise<void> {
        return Progress.execFunctionWithProgress('Opening Console Dashboard', async (progress) => {
            const consoleUrl = (await Oc.Instance.getConsoleInfo()).url;
            progress.report({ increment: 100, message: 'Starting default browser' });
            return commands.executeCommand('vscode.open', Uri.parse(consoleUrl));
        });
    }

    @vsCommand('openshift.open.operatorBackedServiceCatalog')
    @clusterRequired()
    static async openOpenshiftConsoleTopography(): Promise<void> {
        return Progress.execFunctionWithProgress(
            'Opening Operator Backed Service Catalog',
            async (progress) => {
                const [consoleInfo, namespace] = await Promise.all([
                    Oc.Instance.getConsoleInfo(),
                    Odo.Instance.getActiveProject(),
                ]);
                progress.report({ increment: 100, message: 'Starting default browser' });
                // eg. https://console-openshift-console.apps-crc.testing/catalog/ns/default?catalogType=OperatorBackedService
                // FIXME: handle standard k8s dashboard
                return commands.executeCommand(
                    'vscode.open',
                    Uri.parse(
                        `${consoleInfo.url}/catalog/ns/${namespace}?catalogType=OperatorBackedService`,
                    ),
                );
            },
        );
    }

    @vsCommand('openshift.resource.openInDeveloperConsole')
    @clusterRequired()
    static async openInDeveloperConsole(resource: KubernetesObject): Promise<void> {
        return Progress.execFunctionWithProgress('Opening Console Dashboard', async (progress) => {
            const consoleInfo = await Oc.Instance.getConsoleInfo();
            progress.report({ increment: 100, message: 'Starting default browser' });
            // FIXME: handle standard k8s dashboard
            return commands.executeCommand(
                'vscode.open',
                Uri.parse(
                    `${consoleInfo.url}/topology/ns/${resource.metadata.namespace}?selectId=${resource.metadata.uid}&view=graph`,
                ),
            );
        });
    }

    @vsCommand('openshift.resource.openInBrowser')
    @clusterRequired()
    static openInBrowser(resource: KubernetesObject): Promise<void> {
        return Progress.execFunctionWithProgress('Opening in browser', async (progress) => {
            const routeURL = await Oc.Instance.getRouteURL(resource.metadata.name);
            if (routeURL) {
                progress.report({ increment: 100, message: 'Starting default browser' });
                // FIXME: handle standard k8s dashboard
                return commands.executeCommand(
                    'vscode.open',
                    Uri.parse(
                        `http://${routeURL}`,
                    ),
                );
            }
        });
    }

    @vsCommand('openshift.explorer.switchContext')
    static async switchContext(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const k8sConfig = new KubeConfigUtils();
            const contexts = k8sConfig.contexts.filter(
                (item) => item.name !== k8sConfig.currentContext,
            );
            const deleteBtn = new quickBtn(new ThemeIcon('trash'), 'Delete');
            const quickPick = window.createQuickPick();
            const contextNames: QuickPickItem[] = contexts.map((ctx) => ({
                label: `${ctx.name}`,
                buttons: [deleteBtn],
            }));
            quickPick.items = contextNames;
            const cancelBtn = new quickBtn(new ThemeIcon('close'), 'Cancel');
            quickPick.buttons = [QuickInputButtons.Back, cancelBtn];
            if (contextNames.length === 0) {
                void window
                    .showInformationMessage(
                        'You have no Kubernetes contexts yet, please login to a cluster.',
                        'Login',
                        'Cancel',
                    )
                    .then((command: string) => {
                        if (command === 'Login') {
                            resolve(Cluster.login(undefined, true));
                        }
                        resolve(null);
                    });
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
                    Oc.Instance.setContext(choice.label)
                        .then(() => resolve(`Cluster context is changed to: ${choice.label}.`))
                        .catch(reject);
                });
                quickPick.onDidTriggerButton((button) => {
                    if (button === QuickInputButtons.Back || button === cancelBtn) quickPick.hide();
                });
                quickPick.onDidTriggerItemButton(async (event: QuickPickItemButtonEvent<QuickPickItem>) => {
                    if (event.button === deleteBtn) {
                        await window.showInformationMessage(`Do you want to delete '${event.item.label}' Context from Kubernetes configuration?`, 'Yes', 'No')
                            .then((command: string) => {
                                if (command === 'Yes') {
                                    const context = k8sConfig.getContextObject(event.item.label);
                                    const index = contexts.indexOf(context);
                                    if (index > -1) {
                                        Oc.Instance.deleteContext(context.name)
                                            .then(() => resolve(`Context ${context.name} deleted.`))
                                            .catch(reject);
                                    }
                                }
                            });
                    }
                });
                quickPick.show();
            }
        });
    }

    static async getUrl(): Promise<string | null | undefined> {
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
            const contextNames: QuickPickItem[] = clusterItems.map((ctx) => ({
                ...ctx,
                buttons: ctx.description ? [] : [deleteBtn],
            }));
            quickPick.items = [createUrl, ...contextNames];
            const cancelBtn = new quickBtn(new ThemeIcon('close'), 'Cancel');
            quickPick.buttons = [QuickInputButtons.Back, cancelBtn];
            let selection: readonly QuickPickItem[] | undefined;
            const hideDisposable = quickPick.onDidHide(() => resolve(null));
            quickPick.onDidAccept(async () => {
                const choice = selection[0];
                hideDisposable.dispose();
                quickPick.hide();
                if (choice.label === createUrl.label) {
                    const prompt = 'Provide new Cluster URL to connect';
                    const validateInput = (value: string) => NameValidator.validateUrl('Invalid URL provided', value);
                    const newURL = await inputValue(prompt, '', false, validateInput);
                    if (newURL === null) return null; // Cancel
                    else if (!newURL) resolve(await Cluster.showQuickPick(clusterURl)); // Back
                    else resolve(newURL);
                } else {
                    resolve(choice.label);
                }
            });
            quickPick.onDidChangeSelection((selects) => {
                selection = selects;
            });
            quickPick.onDidTriggerButton((button) => {
                hideDisposable.dispose();
                quickPick.hide();
                if (button === QuickInputButtons.Back) resolve(undefined);
                else if (button === cancelBtn) resolve(null);
            });
            quickPick.onDidTriggerItemButton(async (event) => {
                if (event.button === deleteBtn) {
                    await window.showInformationMessage(`Do you want to delete ${event.item.label} Cluster and all the related Contexts and Users form Kubernetes configuration?`, 'Yes', 'No')
                        .then( async (command: string) => {
                            if (command === 'Yes') {
                                const cluster = k8sConfig.getClusters().find((kubeConfigCluster) => kubeConfigCluster.server === event.item.label);
                                const contexts = k8sConfig.getContexts().filter((kubeContext) => kubeContext.cluster === cluster.name);
                                // find users and remove duplicates
                                const users = [ ...new Set(contexts.map(context => k8sConfig.getUser(context.user)))];

                                await Promise.all(
                                    contexts.map((context) =>
                                        Oc.Instance.deleteContext(context.name),
                                    ),
                                )
                                    .then(() =>
                                        Promise.all(
                                            users.map((user) =>
                                                Oc.Instance.deleteUser(user.name)
                                            ),
                                        ),
                                    )
                                    .then(() =>
                                        Oc.Instance.deleteCluster(cluster.name)
                                    )
                                    .catch(reject);
                            }
                        });
                }
            });
            quickPick.show();
        });
    }

    @vsCommand('openshift.explorer.stopCluster')
    static async stop(): Promise<void> {
        let pathSelectionDialog;
        let newPathPrompt;
        let crcBinary;
        const crcPath: string = workspace
            .getConfiguration('openshiftToolkit')
            .get('crcBinaryLocation');
        if (crcPath) {
            newPathPrompt = { label: '$(plus) Provide different OpenShift Local file path' };
            pathSelectionDialog = await window.showQuickPick(
                [{ label: `${crcPath}`, description: 'Fetched from settings' }, newPathPrompt],
                { placeHolder: 'Select OpenShift Local file path', ignoreFocusOut: true },
            );
        }
        if (!pathSelectionDialog) return;
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
        void OpenShiftTerminalManager.getInstance().executeInTerminal(new CommandText(`${crcBinary}`, 'stop'), undefined, 'Stop OpenShift Local');
    }

    /*
     * Shows a Quick Pick to select a cluster login method. Returns either:
     * - login method string, or
     * - `null` in case of user cancelled (pressed `ESC`), or
     * - `undefined` if user pressed `Back` button
     * @returns string contaning cluster login method name or null if cancelled or undefined if Back is pressed
     */
    private static async getLoginMethod(): Promise<string | null | undefined> {
        return new Promise<string | null | undefined>((resolve, reject) => {
            const loginActions: QuickPickItem[] = [
                {
                    label: 'Credentials',
                    description: 'Log in to the given server using credentials',
                },
                {
                    label: 'Token',
                    description: 'Log in to the given server using bearer token',
                }
            ];
            const quickPick = window.createQuickPick();
            quickPick.items = [...loginActions];
            const cancelBtn = new quickBtn(new ThemeIcon('close'), 'Cancel');
            quickPick.buttons = [QuickInputButtons.Back, cancelBtn];
            let selection: readonly QuickPickItem[] | undefined;
            const hideDisposable = quickPick.onDidHide(() => resolve(null));
            quickPick.onDidAccept(() => {
                const choice = selection[0];
                hideDisposable.dispose();
                quickPick.hide();
                resolve(choice.label);
            });
            quickPick.onDidChangeSelection((selects) => {
                selection = selects;
            });
            quickPick.onDidTriggerButton((button) => {
                hideDisposable.dispose();
                quickPick.hide();
                if (button === QuickInputButtons.Back) resolve(undefined);
                else if (button === cancelBtn) resolve(null);
            });
            quickPick.show();
        });
    }

    /**
     * Checks if we're already logged in to a cluster.
     * So, if we are, no need to re-enter User Credentials of Token
     *
     * @param clusterURI URI of the cluster to login
     * @returns true in case we should continue with asking for credentials,
     *      false in case we're already logged in
     */
    static async shouldAskForLoginCredentials(clusterURI: string): Promise<boolean> {
        const kcu = new KubeConfigUtils();
        const cluster: KcuCluster = kcu.findCluster(clusterURI);
        if (!cluster) return true;

        const context = kcu.findContext(cluster.name);
        if (!context) return true;

        // Save `current-context`
        const savedContext = kcu.currentContext;
        try {
            await Oc.Instance.setContext(context.name)
            return await LoginUtil.Instance.requireLogin(cluster.server)
        } catch(error) {
            // Restore saved `current-context`
            await Oc.Instance.setContext(savedContext)
        }
        return true;
    }

    @vsCommand('openshift.explorer.login')
    static async login(context?: any, skipConfirmation = false): Promise<string> {
        const response = await Cluster.requestLoginConfirmation(skipConfirmation);

        if (response !== 'Yes') return null;

        let clusterURL: string;

        enum Step {
            selectCluster = 'selectCluster',
            selectLoginMethod = 'selectLoginMethod',
            loginUsingCredentials = 'loginUsingCredentials',
            loginUsingToken = 'loginUsingToken'
        }

        let step: Step = Step.selectCluster;
        while (step !== undefined) {
            switch (step) {
                case Step.selectCluster: {
                    let clusterIsUp = false;
                    do {
                        clusterURL = await Cluster.getUrl();

                        if (!clusterURL) return null;

                        try {
                            await fetch(`${clusterURL}/api`, {
                                // disable cert checking. crc uses a self-signed cert,
                                // which means this request will always fail on crc unless cert checking is disabled
                                strictSSL: false
                            });

                            // since the fetch didn't throw an exception,
                            // a route to the cluster is available,
                            // so it's running
                            clusterIsUp = true;
                        } catch (e) {
                            let clusterURLObj: any = undefined;
                            try {
                                clusterURLObj = new URL(clusterURL);
                            } catch (_) {
                                // Ignore
                            }
                            if (clusterURLObj && clusterURLObj.hostname === 'api.crc.testing') {
                                const startCrc = 'Start OpenShift Local';
                                const promptResponse = await window.showWarningMessage(
                                    'The cluster appears to be a OpenShift Local cluster, but it isn\'t running',
                                    'Use a different cluster',
                                    startCrc,
                                );
                                if (promptResponse === startCrc){
                                    await commands.executeCommand('openshift.explorer.addCluster', 'crc');
                                    // no point in continuing with the wizard,
                                    // it will take the cluster a few minutes to stabilize
                                    return null;
                                }
                            } else if (clusterURLObj && /api\.sandbox-.*openshiftapps\.com/.test(clusterURLObj.hostname)) {
                                const devSandboxSignup = 'Sign up for OpenShift Dev Sandbox';
                                const promptResponse = await window.showWarningMessage(
                                    'The cluster appears to be a OpenShift Dev Sandbox cluster, but it isn\'t running',
                                    'Use a different cluster',
                                    devSandboxSignup,
                                );
                                if (promptResponse === devSandboxSignup){
                                    await commands.executeCommand('openshift.explorer.addCluster', 'sandbox');
                                    // no point in continuing with the wizard,
                                    // the user needs to sign up for the service
                                    return null;
                                }
                            } else {
                                void window.showWarningMessage(
                                    'Unable to contact the cluster. Is it running and accessible?',
                                );
                            }
                        }
                    } while (!clusterIsUp);

                    // contibue if cluster requires User Credentials/Token
                    if(!(await Cluster.shouldAskForLoginCredentials(clusterURL))) {
                        return null;
                    }
                    step = Step.selectLoginMethod;
                    break;
                }
                case Step.selectLoginMethod: {
                    const result = await Cluster.getLoginMethod();
                    if (result === null) { // User cancelled the operation
                        return null;
                    } else if (!result) { // Back button is hit
                        step = Step.selectCluster;
                    } else if(result === 'Credentials') {
                        step = Step.loginUsingCredentials;
                    } else if (result === 'Token') {
                        step = Step.loginUsingToken;
                    }
                    break;
                }
                case Step.loginUsingCredentials: // Drop down
                case Step.loginUsingToken: {
                    const successMessage: string = step === Step.loginUsingCredentials
                        ? await Cluster.credentialsLogin(true, clusterURL)
                            : await Cluster.tokenLogin(clusterURL, true);

                    if (successMessage === null) { // User cancelled the operation
                        return null;
                    } else if (!successMessage) { // Back button is hit
                        step = Step.selectLoginMethod;
                    } else {
                        // login successful
                        return successMessage;
                    }
                    break;
                }
                default:
                    break;
            }
        }
    }

    private static async requestLoginConfirmation(skipConfirmation = false): Promise<string> {
        let response = 'Yes';
        if (!skipConfirmation && !(await LoginUtil.Instance.requireLogin())) {
            const cluster = new KubeConfigUtils().getCurrentCluster();
            response = await window.showInformationMessage(
                `You are already logged into ${cluster.server} cluster. Do you want to login to a different cluster?`,
                'Yes',
                'No',
            );
        }
        return response;
    }

    private static async save(
        username: string,
        password: string,
        checkpassword: string,
    ): Promise<void> {
        if (password === checkpassword) return;
        const response = await window.showInformationMessage(
            'Do you want to save username and password?',
            'Yes',
            'No',
        );
        if (response === 'Yes') {
            await TokenStore.setUserName(username);
            await TokenStore.setItem('login', username, password);
        }
    }

    /*
     * Shows a Quick Pick to select or type in a username. Returns either:
     * - username string, or
     * - `null` in case of user cancelled (pressed `ESC`), or
     * - `undefined` if user pressed `Back` button
     * @returns string contaning user name or null if cancelled or undefined if Back is pressed
     */
    private static async getUserName(clusterURL: string, addUserLabel: string): Promise<string | null | undefined> {
        return new Promise<string | null | undefined>((resolve, reject) => {
            const users = new KubeConfigUtils().getClusterUsers(clusterURL);
            const addUser: QuickPickItem = { label: addUserLabel };

            const quickPick = window.createQuickPick();
            quickPick.items = [addUser, ...users];
            const cancelBtn = new quickBtn(new ThemeIcon('close'), 'Cancel');
            quickPick.buttons = [QuickInputButtons.Back, cancelBtn];
            let selection: readonly QuickPickItem[] | undefined;
            const hideDisposable = quickPick.onDidHide(() => resolve(null));
            quickPick.onDidAccept(() => {
                const choice = selection[0];
                hideDisposable.dispose();
                quickPick.hide();
                resolve(choice.label);
            });
            quickPick.onDidChangeSelection((selects) => {
                selection = selects;
            });
            quickPick.onDidTriggerButton((button) => {
                hideDisposable.dispose();
                quickPick.hide();
                if (button === QuickInputButtons.Back) resolve(undefined);
                else if (button === cancelBtn) resolve(null);
            });
            quickPick.show();
        });
    }

    @vsCommand('openshift.explorer.login.credentialsLogin')
    static async credentialsLogin(skipConfirmation = false, userClusterUrl?: string, userName?: string, userPassword?: string): Promise<string | null | undefined> {
        let password: string;
        const response = await Cluster.requestLoginConfirmation(skipConfirmation);

        if (response !== 'Yes') return null;

        let clusterURL = userClusterUrl;
        if (!clusterURL) {
            clusterURL = await Cluster.getUrl();
        }

        if (!clusterURL) return null;

        enum Step {
            'getUserName',
            'enterUserName',
            'enterPassword'
        }

        let username = userName;
        // const getUserName = await TokenStore.getUserName();
        let passwd = userPassword;

        let step: Step = Step.getUserName;
        while (step !== undefined) {
            switch (step) {
                case Step.getUserName:
                    if (!username)  {
                        const addUserLabel = '$(plus) Add new user...';
                        const choice = await Cluster.getUserName(clusterURL, addUserLabel);
                        if (!choice) return choice; // Back or Cancel
                        if (choice === addUserLabel) {
                            step = Step.enterUserName;
                        } else {
                            username = choice;
                            step = Step.enterPassword;
                        }
                    }
                    break;
                case Step.enterUserName:
                    if (!username)  {
                        const prompt = 'Provide Username for basic authentication to the API server';
                        const validateInput = (value: string) => NameValidator.emptyName('User name cannot be empty', value ? value : '');
                        const newUsername = await inputValue(prompt, '', false, validateInput);

                        if (newUsername === null) {
                            return null; // Cancel
                        } else if (!newUsername) {
                            username = undefined;
                            step = Step.getUserName; // Back
                        } else {
                            username = newUsername;
                            step = Step.enterPassword;
                        }
                    }
                    break;
                case Step.enterPassword:
                    if (!passwd) {
                        password = await TokenStore.getItem('login', username);
                        const prompt = 'Provide Password for basic authentication to the API server';
                        const validateInput = (value: string) => NameValidator.emptyName('Password cannot be empty', value ? value : '');
                        const newPassword = await inputValue(prompt, password, true, validateInput);

                        if (newPassword === null) {
                            return null; // Cancel
                        } else if (!newPassword) {
                            username = undefined;
                            step = Step.getUserName; // Back
                        } else {
                            passwd = newPassword;
                            step = undefined;
                        }
                    }
                    break;
                default: // Shouldn't happen, but force cycle exit
                    step = undefined;
                    break;
            }
        }
        if (!username || !passwd) return null;

        // If there is saved password for the username - read it
        password = await TokenStore.getItem('login', username);
        try {
            await Oc.Instance.loginWithUsernamePassword(clusterURL, username, passwd);
            await Cluster.save(username, passwd, password);
            return await Cluster.loginMessage(clusterURL);
        } catch (error) {
            if (error instanceof VsCommandError) {
                throw new VsCommandError(
                    `Failed to login to cluster '${clusterURL}' with '${Filters.filterPassword(
                        error.message,
                    )}'!`,
                    `Failed to login to cluster. ${error.telemetryMessage}`,
                );
            } else {
                throw new VsCommandError(
                    `Failed to login to cluster '${clusterURL}' with '${Filters.filterPassword(
                        error.message,
                    )}'!`,
                    'Failed to login to cluster',
                );
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
        if (NameValidator.ocLoginCommandMatches(clipboard)) {
            return NameValidator.clusterURL(clipboard);
        }
        return null;
    }

    @vsCommand('openshift.explorer.login.tokenLogin')
    static async tokenLogin(
        userClusterUrl: string,
        skipConfirmation = false,
        userToken?: string,
    ): Promise<string | null> {
        let token: string;
        const response = await Cluster.requestLoginConfirmation(skipConfirmation);

        if (response !== 'Yes') return null;

        let clusterURL = userClusterUrl;
        let clusterUrlFromClipboard: string;

        if (!clusterURL) {
            clusterUrlFromClipboard = await Cluster.getUrlFromClipboard();
        }

        if (
            (!clusterURL && clusterUrlFromClipboard) ||
            clusterURL?.trim() === clusterUrlFromClipboard
        ) {
            token = NameValidator.getToken(await Cluster.readFromClipboard());
            clusterURL = clusterUrlFromClipboard;
        }

        if (!clusterURL) {
            clusterURL = await Cluster.getUrl();
        }

        let ocToken: string;
        if (!userToken) {
            const prompt = 'Provide Bearer token for authentication to the API server';
            const validateInput = (value: string) => NameValidator.emptyName('Bearer token cannot be empty', value ? value : '');
            ocToken = await inputValue(prompt,  token ? token : '', true, validateInput);
            if (ocToken === null) {
                return null; // Cancel
            } else if (!ocToken) {
                return undefined; // Back
            }
        } else {
            ocToken = userToken;
        }
        return Progress.execFunctionWithProgress(`Login to the cluster: ${clusterURL}`, () =>
            Oc.Instance.loginWithToken(clusterURL, ocToken)
                .then(() => Cluster.loginMessage(clusterURL))
                .catch((error) =>
                    Promise.reject(
                        new VsCommandError(
                            `Failed to login to cluster '${clusterURL}' with '${Filters.filterToken(
                                error.message,
                            )}'!`,
                            'Failed to login to cluster',
                        ),
                    ),
                ),
        );
    }

    static validateLoginToken(token: string): boolean {
        const sha256Regex = new RegExp('^sha256~([A-Za-z0-9_]+)');
        return sha256Regex.test(token);
    }

    @vsCommand('openshift.explorer.login.clipboard')
    static async loginUsingClipboardToken(
        apiEndpointUrl: string,
        oauthRequestTokenUrl: string,
    ): Promise<string | null> {
        const clipboard = await Cluster.readFromClipboard();
        if (!clipboard) {
            const choice = await window.showErrorMessage(
                'Cannot parse token in clipboard. Please click `Get token` button below, copy token into clipboard and press `Login to Sandbox` button again.',
                'Get token',
            );
            if (choice === 'Get token') {
                await commands.executeCommand('vscode.open', Uri.parse(oauthRequestTokenUrl));
            }
            return;
        }
        return Cluster.tokenLogin(apiEndpointUrl, true, clipboard);
    }

    static async loginUsingClipboardInfo(dashboardUrl: string): Promise<string | null> {
        const clipboard = await Cluster.readFromClipboard();
        if (!NameValidator.ocLoginCommandMatches(clipboard)) {
            const choice = await window.showErrorMessage('Cannot parse login command in clipboard. Please open cluster dashboard and select `Copy login command` from user name dropdown in the upper right corner. Copy full login command to clipboard. Switch back to VSCode window and press `Login to Sandbox` button again.',
                'Open Dashboard');
            if (choice === 'Open Dashboard') {
                await commands.executeCommand('vscode.open', Uri.parse(dashboardUrl));
            }
            return;
        }
        const url = NameValidator.clusterURL(clipboard);
        const token = NameValidator.getToken(clipboard);
        return Cluster.tokenLogin(url, true, token);
    }

    static async loginMessage(clusterURL: string): Promise<string> {
        OpenShiftExplorer.getInstance().refresh();
        Cluster.serverlessView.refresh();
        await commands.executeCommand('setContext', 'isLoggedIn', true);
        return `Successfully logged in to '${clusterURL}'`;
    }
}
