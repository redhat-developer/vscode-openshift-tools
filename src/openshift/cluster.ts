/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CoreV1Api, KubeConfig, KubernetesObject, V1Secret, V1ServiceAccount } from '@kubernetes/client-node';
import { Cluster as KcuCluster, Context as KcuContext, User } from '@kubernetes/client-node/dist/config_types';
import * as https from 'https';
import { Disposable, ExtensionContext, QuickInputButtons, QuickPickItem, QuickPickItemButtonEvent, QuickPickItemKind, ThemeIcon, Uri, commands, env, window, workspace } from 'vscode';
import { CommandText } from '../base/command';
import { CliChannel } from '../cli';
import { OpenShiftExplorer } from '../explorer';
import { Oc } from '../oc/ocWrapper';
import { Command } from '../odo/command';
import * as NameValidator from '../openshift/nameValidator';
import { TokenStore } from '../util/credentialManager';
import { Filters } from '../util/filters';
import { inputValue, quickBtn } from '../util/inputValue';
import { KubeConfigInfo, extractProjectNameFromContextName } from '../util/kubeUtils';
import { LoginUtil } from '../util/loginUtil';
import { Platform } from '../util/platform';
import { Progress } from '../util/progress';
import { imagePath } from '../util/utils';
import { VsCommandError, vsCommand } from '../vscommand';
import { OpenShiftTerminalManager } from '../webview/openshift-terminal/openShiftTerminal';
import OpenShiftItem, { clusterRequired } from './openshiftItem';

export interface QuickPickItemExt extends QuickPickItem {
    name: string,
    cluster: string,
    user: string,
    namespace: string
}

export class Cluster extends OpenShiftItem implements Disposable {
    private static instance: Cluster;

    public static getInstance(): Cluster {
        if (!Cluster.instance) {
            Cluster.instance = new Cluster();
        }
        return Cluster.instance;
    }

    dispose() { }

    public static extensionContext: ExtensionContext;

    @vsCommand('openshift.explorer.logout')
    static async logout(): Promise<void> {
        const thenable = Cluster.logoutInternal();
        window.setStatusBarMessage('$(sync~spin) Logging out of cluster...', thenable);
        return thenable;
    }

    static async logoutInternal(): Promise<void> {
        const value = await window.showWarningMessage(
            'Do you want to logout of cluster?',
            'Logout',
            'Cancel',
        );
        if (value === 'Logout') {
            await LoginUtil.Instance.logout()
                .catch(async (error) =>
                    Promise.reject(
                        new VsCommandError(
                            `Failed to logout of the current cluster with '${error}'!`,
                            'Failed to logout of the current cluster',
                        ),
                    ),
                )
                .then(() => {
                    OpenShiftExplorer.getInstance().refresh();
                    Cluster.serverlessView.refresh();
                    void commands.executeCommand('setContext', 'isLoggedIn', false);
                    void window.showInformationMessage(
                            'Successfully logged out. Do you want to login to a new cluster',
                            'Yes',
                            'No',
                        ).then((logoutInfo) => {
                            if (logoutInfo === 'Yes') {
                                return Cluster.login(undefined, true);
                            }
                        });
                });
        }
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
                    Oc.Instance.getActiveProject(),
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

    private static getProjectLabel(ctx: KcuContext): string {
        const pn = extractProjectNameFromContextName(ctx.name) || '';
        const ns = ctx.namespace || pn;
        let label = ns.length > 0 ? ns : '[default]';
        if (ns !== pn && pn.length > 0) label = `${label} (${pn})`;
        return label;
    }

    @vsCommand('openshift.explorer.switchContext')
    static async switchContext(): Promise<string> {
        const abortController = new AbortController();
        if (!(await Cluster.checkOngoingOperation(abortController))) {
            return null;
        }

        Cluster.ongoingOperationCanceller = abortController;
        const thenable = Cluster.switchContextInternal(abortController)
            .then((result) => {
                if (Cluster.ongoingOperationCanceller === abortController) {
                    Cluster.ongoingOperationCanceller = undefined;
                }
                return result;
            })
            .catch((error) => {
                if (Cluster.ongoingOperationCanceller === abortController) {
                    Cluster.ongoingOperationCanceller = undefined;
                }
                throw new Error(error);
            });
        window.setStatusBarMessage('$(sync~spin) Switching context...', thenable);
        return thenable;
   }

    static async switchContextInternal(abortController?: AbortController): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const deleteBtn = new quickBtn(new ThemeIcon('trash'), 'Delete');
            const quickPick = window.createQuickPick();

            const k8sConfigInfo = new KubeConfigInfo();
            const k8sConfig = k8sConfigInfo.getEffectiveKubeConfig();
            const contextEntries = [...k8sConfigInfo.getContextMap()];
            const contextItems: any[] = []; // Will contain QuickPickItem properties plus some additional ones

            const currentCtxPaths = contextEntries.filter(([key, value]) => value.find((c) => c.name === k8sConfig.currentContext)).map(([key, value]) => key);

            // Show first the items that come from the config that defines the current context
            contextEntries.filter(([key, value]) => currentCtxPaths.length > 0 && currentCtxPaths.find((p) => p === key)).forEach(([key, value]) => {
                contextItems.push( {kind: QuickPickItemKind.Separator, label: key});
                // Show the current context first
                value.filter((ctx) => ctx.name === k8sConfig.currentContext).forEach((ctx) => {
                    contextItems.push( {
                        label: ctx.name,
                        cluster: `${ctx.cluster}`,
                        user: `${ctx.user}`,
                        namespace: `${ctx.namespace}`,
                        description: `on ${ctx.cluster}`,
                        detail: `Current Context: Project: ${Cluster.getProjectLabel(ctx)}, User: ${ctx.user}`,
                        iconPath: new ThemeIcon('layers-active'),
                        picked: true
                    });
                });
                // Show the rest contexts from the same config
                value.filter((ctx) => ctx.name !== k8sConfig.currentContext).forEach((ctx) => {
                    contextItems.push( {
                        label: ctx.name,
                        cluster: `${ctx.cluster}`,
                        user: `${ctx.user}`,
                        namespace: `${ctx.namespace}`,
                        description: `on ${ctx.cluster}`,
                        detail: `Project: ${Cluster.getProjectLabel(ctx)}, User: ${ctx.user}`,
                        buttons: [deleteBtn],
                        iconPath: new ThemeIcon('layers'),
                        picked: false
                    });
                });
            });
            // Show the rest items
            contextEntries.filter(([key, value]) => currentCtxPaths.length === 0 || currentCtxPaths?.find((p) => p !== key)).forEach(([key, value]) => {
                contextItems.push( {kind: QuickPickItemKind.Separator, label: key});
                value.forEach((ctx) => {
                    contextItems.push( {
                        label: ctx.name,
                        cluster: `${ctx.cluster}`,
                        user: `${ctx.user}`,
                        namespace: `${ctx.namespace}`,
                        description: `on ${ctx.cluster}`,
                        detail: `Project: ${Cluster.getProjectLabel(ctx)}, User: ${ctx.user}`,
                        buttons: [deleteBtn],
                        iconPath: new ThemeIcon('layers'),
                        picked: false
                    });
                });
            });

            quickPick.items = contextItems;
            quickPick.matchOnDetail = true;
            quickPick.matchOnDescription = true;

            const cancelBtn = new quickBtn(new ThemeIcon('close'), 'Cancel');
            quickPick.buttons = [QuickInputButtons.Back, cancelBtn];
            if (contextItems.length === 0) {
                void window
                    .showInformationMessage(
                        'You have no Kubernetes contexts yet, please login to a cluster.',
                        'Login',
                        'Cancel',
                    )
                    .then((command: string) => {
                        if (command === 'Login') {
                            resolve(Cluster.login(undefined, true, abortController));
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
                    const choice = selection[0] as QuickPickItemExt;
                    hideDisposable.dispose();
                    quickPick.hide();
                    if (choice.label === k8sConfig.currentContext) {
                        const currentContext = k8sConfigInfo.findContext(k8sConfig.currentContext);
                        const pr = currentContext ? Cluster.getProjectLabel(currentContext) : 'not defined';
                        const cl = currentContext ? currentContext.cluster : 'not defined';
                        const msg = `You've already switched to context '${k8sConfig.currentContext}' with project '${pr}' on cluster '${cl}'.`;
                        void window.showWarningMessage(msg);
                        // resolve(msg);
                    }
                    Oc.Instance.setContext(choice.label)
                        .then(async () => {
                            const clusterURL = k8sConfigInfo.findClusterURL(choice.cluster);
                            if (await LoginUtil.Instance.requireLogin(clusterURL)) {
                                const status = await Cluster.login(choice.label, true, abortController);
                                if (status) {
                                    const newConfigInfo = new KubeConfigInfo(); // Can be updated after login
                                    if (Cluster.isSandboxCluster(clusterURL)
                                            && !newConfigInfo.equalsToCurrentContext(choice.name, choice.cluster, choice.namespace, choice.user)) {
                                        await window.showWarningMessage(
                                            'The cluster appears to be a OpenShift Dev Sandbox cluster, \
                                            but the required project doesn\'t appear to be existing. \
                                            The cluster provided default project is selected instead. ',
                                            'OK',
                                        );
                                    }
                                }
                            }
                            const kci = new KubeConfigInfo();
                            const currentContext = kci.findContext(kci.getEffectiveKubeConfig().currentContext);
                            const pr = currentContext ? Cluster.getProjectLabel(currentContext) : 'not defined';
                            const cl = currentContext ? currentContext.cluster : 'not defined';
                            resolve(`Cluster context is changed to '${currentContext.name}' with project '${pr}' on cluster '${cl}'.`);
                        })
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
                                    const context = k8sConfigInfo.findContext((event.item as any).name);
                                    if (context) {
                                        Oc.Instance.deleteContext(context.name)
                                            .then(() => resolve(`Context ${context.name} deleted.`))
                                            .catch(reject);
                                    }
                                }
                            });
                    }
                });
                if (abortController) {
                    abortController.signal.addEventListener('abort', (ev) => quickPick.hide());
                }
                quickPick.show();
            }
        });
    }

    static async getUrl(abortController?: AbortController): Promise<string | null | undefined> {
        const clusterURl = await Cluster.getUrlFromClipboard();
        return await Cluster.showQuickPick(clusterURl, abortController);
    }

    private static async showQuickPick(clusterURl: string, abortController?: AbortController): Promise<string> {
        return new Promise<string | null>((resolve, reject) => {
            const deleteBtn = new quickBtn(new ThemeIcon('trash'), 'Delete');
            const createUrl: QuickPickItem = { label: '$(plus) Provide new URL...' };
            const quickPick = window.createQuickPick();

            const k8sConfigInfo = new KubeConfigInfo();
            const k8sConfig = k8sConfigInfo.getEffectiveKubeConfig();
            const clusterEntries = [...k8sConfigInfo.getClusterMap()];
            const currentCluster = k8sConfig.getCurrentCluster();
            const clusterItems: any[] = []; // Will contain QuickPickItem properties plus some additional ones

            const currentClusterPaths = currentCluster ? clusterEntries.filter(([key, value]) => value.find((c) => c.name === currentCluster.name)).map(([key, value]) => key) : [];

            // Show first the items that come from the config that defines the current cluster
            clusterEntries.filter(([key, value]) => currentClusterPaths.length > 0 && currentClusterPaths.find((p) => p === key)).forEach(([key, value]) => {
                clusterItems.push( {kind: QuickPickItemKind.Separator, label: key});
                // Show the current cluster first
                value.filter((cluster) => cluster.name === currentCluster.name).forEach((c) => {
                    clusterItems.push( {
                        label: c.name,
                        server: c.server,
                        detail: `Current Server: ${c.server}`,
                        iconPath: imagePath('context/cluster-node.png'),
                        picked: true
                    });
                });
                // Show the rest contexts from the same config
                value.filter((cluster) => cluster.name !== currentCluster.name).forEach((c) => {
                    clusterItems.push( {
                        label: c.name,
                        server: c.server,
                        detail: `Server: ${c.server}`,
                        iconPath: imagePath('context/cluster-node-gray.png'),
                        picked: false
                    });
                });
            });
            // Show the rest items
            clusterEntries.filter(([key, value]) => currentClusterPaths.length === 0 || currentClusterPaths.find((p) => p !== key)).forEach(([key, value]) => {
                clusterItems.push( {kind: QuickPickItemKind.Separator, label: key});
                value.forEach((c) => {
                    clusterItems.push( {
                        label: c.name,
                        server: c.server,
                        // description: `on ${ctx.cluster}`,
                        detail: `Server: ${c.server}`,
                        iconPath: imagePath('context/cluster-node-gray.png'),
                        picked: false
                    });
                });
            });

            quickPick.items = [createUrl, ...clusterItems];
            quickPick.matchOnDetail = true;
            quickPick.matchOnDescription = true;

            const cancelBtn = new quickBtn(new ThemeIcon('close'), 'Cancel');
            quickPick.buttons = [QuickInputButtons.Back, cancelBtn];
            let selection: readonly QuickPickItem[] | undefined;
            const hideDisposable = quickPick.onDidHide(() => resolve(null));
            quickPick.onDidAccept(async () => {
                const choice = selection[0] as any;
                hideDisposable.dispose();
                quickPick.hide();
                if (choice.label === createUrl.label) {
                    const prompt = 'Provide new Cluster URL to connect';
                    const validateInput = (value: string) => NameValidator.validateUrl('Invalid URL provided', value);
                    const newURL = await inputValue(prompt, '', false, validateInput, undefined, abortController);
                    if (newURL === null) reject(null as Error); // Cancel
                    else if (!newURL) resolve(await Cluster.showQuickPick(clusterURl, abortController)); // Back
                    else resolve(newURL);
                } else {
                    resolve(choice.server);
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
                                            users.map((user: User) =>
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
            if (abortController) {
                abortController.signal.addEventListener('abort', (ev) => {
                    hideDisposable.dispose();
                    quickPick.hide();
                    resolve(null);
                });
            }
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
     * @param clusterURL a cluster to login to
     * @param abortController if provided, allows cancelling the operation
     * @returns string contaning cluster login method name or null if cancelled or undefined if Back is pressed
     */
    private static async getLoginMethod(clusterURL: string, abortController?: AbortController): Promise<string | null | undefined> {
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
            quickPick.placeholder=`Select the log in method for: ${clusterURL}`;
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
            if (abortController) {
                abortController.signal.addEventListener('abort', (ev) => {
                    hideDisposable.dispose();
                    quickPick.hide();
                    resolve(null);
                });
            }
            quickPick.show();
        });
    }

    /**
     * Checks if we're already logged in to a cluster.
     * So, if we are, no need to re-enter User Credentials of Token.
     *
     * If contextName is specified and points to a cluster with the same URI as clusterURI,
     * the context is used as context to be switched to. Otherwise, we'll use the first
     * context found for the clusrtURI specified.
     *
     * @param clusterURI URI of the cluster to login
     * @returns true in case we should continue with asking for credentials,
     *      false in case we're already logged in
     */
    static async shouldAskForLoginCredentials(clusterURI: string, contextName?: string): Promise<boolean> {
        const kci = new KubeConfigInfo();
        const cluster: KcuCluster = kci.findCluster(clusterURI);
        if (!cluster) return true;

        let context: KcuContext = contextName && kci.findContext(contextName);
        if (!context || context.cluster !== context.cluster) {
            context = kci.findContextForCluster(cluster.name);
        }
        if (!context) return true;

        // Save `current-context`
        const savedContext = kci.getEffectiveKubeConfig().currentContext;
        try {
            await Oc.Instance.setContext(context.name)
            return await LoginUtil.Instance.requireLogin(cluster.server)
        } catch {
            // Restore saved `current-context`
            await Oc.Instance.setContext(savedContext)
        }
        return true;
    }

    private static isOpenshiftLocalCluster(clusterURL: string): boolean {
        try {
            return new URL(clusterURL).hostname === 'api.crc.testing';
        } catch {
            return false;
        }
    }

    private static isSandboxCluster(clusterURL: string): boolean {
        try {
            return /api\.sandbox-.*openshiftapps\.com/.test(new URL(clusterURL).hostname);
        } catch {
            return false;
        }
    }

    private static ongoingOperationCanceller: AbortController;

    /**
     * Checks if a new operation can be started.
     * If an ongoing operation is already started, asks if user really wants to cancel it and start a new one,
     * If user agrees - the ongoing operation gets canceled.
     *
     * @param abortController if provided, allows cancelling the operation
     * @returns true if we can start a new operation, false - otherwise
     */
    private static async checkOngoingOperation(abortController: AbortController): Promise<boolean> {
        if (Cluster.ongoingOperationCanceller && Cluster.ongoingOperationCanceller !== abortController) {
            let response = 'Yes';
            const cluster = new KubeConfigInfo().getEffectiveKubeConfig().getCurrentCluster();
            response = await window.showInformationMessage(
                `You are already trying to login to ${cluster ? cluster.server : ''} cluster. Do you want to login to cancel and try again?`,
                'Yes',
                'No',
            );
            if (response !== 'Yes') {
                return false;
            }

            // Do cancell here.
            if (Cluster.ongoingOperationCanceller) {
                Cluster.ongoingOperationCanceller.abort();
            }
        }

        return true;
    }

    /**
     * Checks the availability of a given cluster
     *
     * @param url Cluster URL to check
     * @param abortController if provided, allows cancelling the operation
     * @returns true if cluster is available, false if cluster is not available or the operation is cancelled
     */
    static async pingCluster(url: string, abortController: AbortController): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            const signal = abortController?.signal;
            const options = { rejectUnauthorized: false, signal };
            https.get(`${url}/api`, options, (response) => {
                if (response.statusCode < 500) {
                    resolve(true);
                } else {
                    reject(new Error(`Connect error: ${response.statusMessage}`));
                }
            }).on('error', (e) => {
                reject(new Error(`Connect error: ${e}`));
            }).on('success', (s) => {
                resolve(true);
            });
        });
    }

    /**
     * Login to a cluster
     *
     * @param context - Required context name
     * @param skipConfirmation - 'true' in case we don't need any confirmation, 'false' - otherwise
     * @param abortController if provided, allows cancelling the operation
     * @returns Successful login message, otherwise - 'null'
     */
    @vsCommand('openshift.explorer.login')
    static async login(context?: string, skipConfirmation = false, abortController?: AbortController): Promise<string> {
        let clusterURL: string = undefined;
        if (context) {
            // If context is specified, we'll initialize clusterURL from it
            const kci = new KubeConfigInfo();
            const ctx = kci.findContext(context);
            clusterURL = ctx && kci.findClusterURL(ctx.cluster);
        }

        const localAbortController = abortController || new AbortController();
        if (!(await Cluster.checkOngoingOperation(localAbortController))) {
            return null;
        }

        Cluster.ongoingOperationCanceller = localAbortController;
        const thenable = Cluster.loginInternal(context, skipConfirmation, localAbortController)
            .then((result) => {
                if (Cluster.ongoingOperationCanceller === localAbortController) {
                    Cluster.ongoingOperationCanceller = undefined;
                }
                return result;
            })
            .catch((error) => {
                if (Cluster.ongoingOperationCanceller === localAbortController) {
                    Cluster.ongoingOperationCanceller = undefined;
                }
                throw new Error(error);
            });

        window.setStatusBarMessage(`$(sync~spin) Logging in${clusterURL ? ` to ${clusterURL}` : ''}...`, thenable);
        return thenable;
    }

    static async loginInternal(context?: string, skipConfirmation = false, abortController?: AbortController): Promise<string> {
        const response = await Cluster.requestLoginConfirmation(skipConfirmation);

        if (response !== 'Yes') return null;

        let clusterURL: string;
        if (context) {
            // If context is specified, we'll initialize clusterURL from it
            const kci = new KubeConfigInfo();
            const ctx = kci.findContext(context);
            clusterURL = ctx && kci.findClusterURL(ctx.cluster);
        }

        enum Step {
            selectCluster = 'selectCluster',
            selectLoginMethod = 'selectLoginMethod',
            loginUsingCredentials = 'loginUsingCredentials',
            loginUsingToken = 'loginUsingToken'
        }

        let step: Step = Step.selectCluster;
        while (step !== undefined) {
            if (abortController?.signal.aborted) {
                return null;
            }
            switch (step) {
                case Step.selectCluster: {
                    let clusterIsUp = false;
                    do {
                        if (!clusterURL) {
                            clusterURL = await Cluster.getUrl(abortController);
                        }
                        if (!clusterURL) return null;

                        try {
                            clusterIsUp  = await Cluster.pingCluster(clusterURL, abortController);
                        } catch {
                            if (abortController?.signal.aborted) {
                                return null; // Silently exit
                            }
                            if (Cluster.isOpenshiftLocalCluster(clusterURL)) {
                                const startCrc = 'Start OpenShift Local';
                                const promptResponse = await window.showWarningMessage(
                                    'The cluster appears to be a OpenShift Local cluster, but it isn\'t running',
                                    'Use a different cluster',
                                    startCrc,
                                );
                                if (promptResponse === startCrc){
                                    await commands.executeCommand('openshift.explorer.addCluster', 'crc');
                                    // it will take the cluster a few minutes to stabilize
                                }
                                // Anyway, no point in continuing with the wizard
                                return null;
                            } else if (Cluster.isSandboxCluster(clusterURL)) {
                                const devSandboxSignup = 'Sign up for OpenShift Dev Sandbox';
                                const promptResponse = await window.showWarningMessage(
                                    'The cluster appears to be a OpenShift Dev Sandbox cluster, but it isn\'t running',
                                    'Use a different cluster',
                                    devSandboxSignup,
                                );
                                if (promptResponse === devSandboxSignup){
                                    await commands.executeCommand('openshift.explorer.addCluster', 'sandbox');
                                    // the user needs to sign up for the service
                                }
                                // Anyway, no point in continuing with the wizard
                                return null;
                            }

                            // Stop trying because the cluster doesn't appear to be available
                            void window.showErrorMessage(
                                `Unable to contact the cluster${ clusterURL && clusterURL.length > 0 ? `: "${clusterURL}"` : ''}. Is it running and accessible?`,
                            );
                            return null;
                        }
                    } while (!clusterIsUp);

                    // contibue if cluster requires User Credentials/Token
                    if(!(await Cluster.shouldAskForLoginCredentials(clusterURL, context))) {
                        return null;
                    }
                    step = Step.selectLoginMethod;
                    break;
                }
                case Step.selectLoginMethod: {
                    const result = await Cluster.getLoginMethod(clusterURL, abortController);
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
                        ? await Cluster.credentialsLogin(clusterURL, true, context, undefined, undefined, abortController)
                            : await Cluster.tokenLogin(clusterURL, true, context, undefined, abortController);

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
            const cluster = new KubeConfigInfo().getEffectiveKubeConfig().getCurrentCluster();
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
     *
     * @param clusterURL a cluster to login to
     * @param addUserLabel a label to be shown for add new user action
     * @param abortController if provided, allows cancelling the operation
     * @returns string contaning user name or null if cancelled or undefined if Back is pressed
     */
    private static async getUserName(clusterURL: string, addUserLabel: string,
        abortController?: AbortController): Promise<string | null | undefined> {
        return new Promise<string | null | undefined>((resolve, reject) => {
            const users = new KubeConfigInfo().getClusterUsers(clusterURL);
            const addUser: QuickPickItem = { label: addUserLabel };

            const quickPick = window.createQuickPick();
            quickPick.placeholder=`Select or add username for: ${clusterURL}`;
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
            if (abortController) {
                abortController.signal.addEventListener('abort', (ev) => {
                    hideDisposable.dispose();
                    quickPick.hide();
                    resolve(null);
                });
            }
            quickPick.show();
        });
    }

    @vsCommand('openshift.explorer.login.credentialsLogin')
    static async credentialsLogin(userClusterUrl?: string, skipConfirmation = false, context?: string,
        userName?: string, userPassword?: string, abortController?: AbortController): Promise<string | null | undefined> {
        let password: string;
        const response = await Cluster.requestLoginConfirmation(skipConfirmation);

        if (response !== 'Yes') return null;

        let clusterURL = userClusterUrl;
        if (!clusterURL) {
            clusterURL = await Cluster.getUrl(abortController);
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
            if (abortController?.signal.aborted) {
                return null;
            }
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
                        const newUsername = await inputValue(prompt, '', false, validateInput,
                            `Provide Username for: ${clusterURL}`, abortController);

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
                        const newPassword = await inputValue(prompt, password, true, validateInput,
                            `Provide Password for: ${clusterURL}`, abortController);

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
        if (!username || !passwd || abortController?.signal.aborted) return null;

        // If there is saved password for the username - read it
        password = await TokenStore.getItem('login', username);
        try {
            await Oc.Instance.loginWithUsernamePassword(clusterURL, username, passwd, context, abortController);
            await Cluster.save(username, passwd, password);
            return await Cluster.loginMessage(clusterURL);
        } catch (error) {
            if (error instanceof VsCommandError) {
                if (abortController?.signal.aborted) return null;

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
        try {
            return await env.clipboard.readText();
        } catch {
            return '';
        }
    }

    static async getUrlFromClipboard(): Promise<string | null> {
        const clipboard = await Cluster.readFromClipboard();
        if (NameValidator.ocLoginCommandMatches(clipboard)) {
            return NameValidator.clusterURL(clipboard);
        }
        return null;
    }

    static async getTokenFromClipboard(): Promise<string> {
        const clipboard = (await Cluster.readFromClipboard()).trim();
        return Cluster.validateLoginToken(clipboard) ? clipboard : '';
    }

    @vsCommand('openshift.explorer.login.tokenLogin')
    static async tokenLogin(
        userClusterUrl: string,
        skipConfirmation = false,
        context?: string,
        userToken?: string,
        abortController?: AbortController
    ): Promise<string | null> {
        const response = await Cluster.requestLoginConfirmation(skipConfirmation);

        if (response !== 'Yes') return null;

        let clusterURL = userClusterUrl;

        if (!clusterURL) {
            clusterURL = await Cluster.getUrl(abortController);
        }

        if (!clusterURL) return null;

        let ocToken: string;
        if (!userToken) {
            const prompt = 'Provide Bearer token for authentication to the API server';
            const validateInput = (value: string) => NameValidator.validateLoginToken('Bearer token should be a valid "sha256" token', value ? value : '');
            const token = await Cluster.getTokenFromClipboard();
            ocToken = await inputValue(prompt, token ? token : '', true, validateInput,
                `Provide Bearer token for: ${clusterURL}`, abortController);
            if (ocToken === null) {
                return null; // Cancel
            } else if (!ocToken) {
                return undefined; // Back
            }
        } else {
            ocToken = userToken;
        }

        if (abortController?.signal.aborted) {
            return null;
        }

        try {
            await Oc.Instance.loginWithToken(clusterURL, ocToken, context, abortController);
            return Cluster.loginMessage(clusterURL);
        } catch (error) {
            if (abortController?.signal.aborted) return null;

            if (error instanceof VsCommandError) {
                throw new VsCommandError(
                    `Failed to login to cluster '${clusterURL}' with '${Filters.filterToken(
                        error.message,
                    )}'!`,
                    `Failed to login to cluster. ${error.telemetryMessage}`,
                );
            } else {
                throw new VsCommandError(
                    `Failed to login to cluster '${clusterURL}' with '${Filters.filterToken(
                        error.message,
                    )}'!`,
                    'Failed to login to cluster',
                );
            }
        }
    }

    static validateLoginToken(token: string): boolean {
        return NameValidator.validateLoginToken('Error', token) === null;
    }

    @vsCommand('openshift.explorer.login.clipboard')
    static async loginUsingClipboardToken(
        apiEndpointUrl: string,
        oauthRequestTokenUrl: string,
    ): Promise<string | null> {
        // for whatever reason the token is padded with spaces at the beginning and end when copied from the website
        const clipboard = (await Cluster.readFromClipboard()).trim();
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
        return Cluster.tokenLogin(apiEndpointUrl, true, undefined, clipboard);
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
        return Cluster.tokenLogin(url, true, undefined, token);
    }

    static async loginMessage(clusterURL: string): Promise<string> {
        OpenShiftExplorer.getInstance().refresh();
        Cluster.serverlessView.refresh();
        await commands.executeCommand('setContext', 'isLoggedIn', true);
        return `Successfully logged in to '${clusterURL}'`;
    }

    static isOpenShiftSandbox(url :string): boolean {
        const asUrl = new URL(url);
        return asUrl.hostname.endsWith('openshiftapps.com');
    }

    static prepareSSOInKubeConfig(proxy: string, username: string, accessToken: string): KubeConfig {
        const kcu = new KubeConfig();
        kcu.loadFromOptions({
            clusters: [{ name: 'sandbox-proxy', server: proxy, skipTLSVerify: false }],
            users: [{ name: 'sso-user', token: accessToken }],
            contexts: [{
                name: 'sandbox-proxy-context',
                cluster: 'sandbox-proxy',
                user: 'sso-user',
                namespace: `${username}-dev`,
            }],
            currentContext: 'sandbox-proxy-context',
        });
        return kcu;
    }

    static async installPipelineSecretToken(k8sApi: CoreV1Api, pipelineServiceAccount: V1ServiceAccount, username: string): Promise<V1Secret> {
        const v1Secret = {
            apiVersion: 'v1',
            kind: 'Secret',
            metadata: {
                name: `pipeline-secret-${username}-dev`,
                annotations: {
                    'kubernetes.io/service-account.name': pipelineServiceAccount.metadata.name,
                    'kubernetes.io/service-account.uid': pipelineServiceAccount.metadata.uid
                }
            },
            type: 'kubernetes.io/service-account-token'
        } as V1Secret

        try {
            await k8sApi.createNamespacedSecret({ namespace: `${username}-dev`, body: v1Secret });
        } catch {
            // Ignore
        }
        const newSecrets = await k8sApi.listNamespacedSecret({ namespace: `${username}-dev` });
        return newSecrets?.items.find((secret) => secret.metadata.name === `pipeline-secret-${username}-dev`);
    }

    static async getPipelineServiceAccountToken(k8sApi: CoreV1Api, username: string): Promise<string> {
        try {
            const serviceAccounts = await k8sApi.listNamespacedServiceAccount({ namespace: `${username}-dev` });
            const pipelineServiceAccount = serviceAccounts.items.find(serviceAccount => serviceAccount.metadata.name === 'pipeline');
            if (!pipelineServiceAccount) {
                return;
            }

            const secrets = await k8sApi.listNamespacedSecret({ namespace: `${username}-dev` });
            let pipelineTokenSecret = secrets?.items.find((secret) => secret.metadata.name === `pipeline-secret-${username}-dev`);
            if (!pipelineTokenSecret) {
                pipelineTokenSecret = await Cluster.installPipelineSecretToken(k8sApi, pipelineServiceAccount, username);
                if (!pipelineTokenSecret) {
                    return;
                }
            }
            return Buffer.from(pipelineTokenSecret.data.token, 'base64').toString();
         } catch {
            // Ignore
        }
    }

    static async loginUsingPipelineServiceAccountToken(server: string, proxy: string, username: string, accessToken: string): Promise<string> {
        const kcu = Cluster.prepareSSOInKubeConfig(proxy, username, accessToken);
        const k8sApi = kcu.makeApiClient(CoreV1Api);
        const pipelineToken =  await this.getPipelineServiceAccountToken(k8sApi, username);
        if (!pipelineToken) {
            return;
        }
        return Cluster.tokenLogin(server, true, kcu.currentContext, pipelineToken);
    }
}