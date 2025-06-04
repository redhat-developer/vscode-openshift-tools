/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { CoreV1Api } from '@kubernetes/client-node';
import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { authentication, AuthenticationSession, commands, ConfigurationTarget, Disposable, env, extensions, OutputChannel, Uri, ViewColumn, WebviewPanel, window, workspace } from 'vscode';
import { CommandText } from '../../base/command';
import { Cluster } from '../../openshift/cluster';
import { createSandboxAPI } from '../../openshift/sandbox';
import { ExtCommandTelemetryEvent } from '../../telemetry';
import { ChildProcessUtil } from '../../util/childProcessUtil';
import { ExtensionID } from '../../util/constants';
import { vsCommand } from '../../vscommand';
import { loadWebviewHtml } from '../common-ext/utils';
import { OpenShiftTerminalManager } from '../openshift-terminal/openShiftTerminal';

let panel: WebviewPanel;

const channel: OutputChannel = window.createOutputChannel('OpenShift Local Logs');
const sandboxAPI = createSandboxAPI();

async function clusterEditorMessageListener (event: any ): Promise<any> {

    let sessionCheck: AuthenticationSession;
    if (event.action?.startsWith('sandbox')) {
        sessionCheck = await authentication.getSession('redhat-account-auth', ['openid'], { createIfNone: false });
        if(!sessionCheck && event.action !== 'sandboxLoginRequest') {
            void panel.webview.postMessage({action: 'sandboxPageLoginRequired'});
            return;
        }
    }

    switch (event.action) {
        case 'openLaunchSandboxPage':
        case 'openCreateClusterPage':
        case 'openCrcAddClusterPage':
        case 'crcSetup':
        case 'crcStart':
        case 'crcStop':
            await commands.executeCommand(`openshift.explorer.addCluster.${event.action}`, event);
            break;

        case 'crcSaveSettings':
            void ClusterViewLoader.crcSaveSettings(event);
            break;

        case 'checksetting': {
            const binaryFromSetting: string = workspace.getConfiguration('openshiftToolkit').get('crcBinaryLocation');
            if (binaryFromSetting) {
                await panel.webview.postMessage({action: 'crcsetting'});
                void ClusterViewLoader.checkCrcStatus(binaryFromSetting, 'crcstatus', panel);
            }
            break;
        }
        case 'checkcrcstatus':
            await ClusterViewLoader.checkCrcStatus(event.data, 'crcstatus', panel);
            break;

        case 'crcLogin':
            void commands.executeCommand(
                'openshift.explorer.login.credentialsLogin',
                true,
                event.url,
                event.data.username,
                event.data.password
            );
            break;
        case 'sandboxCheckAuthSession':
            void panel.webview.postMessage({action: 'sandboxPageDetectStatus'});
            break;
        case 'sandboxRequestSignup': {
            const telemetryEventSignup = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.sandboxRequestSignup');
            try {
                const signupResponse = await sandboxAPI.signUp((sessionCheck as any).idToken);
                await panel.webview.postMessage({action: 'sandboxPageDetectStatus'});
                if (!signupResponse) {
                    void window.showErrorMessage('Sign up request for OpenShift Sandbox failed, please try again.');
                    telemetryEventSignup.sendError('Sign up request for OpenShift Sandbox failed.');
                } else {
                    telemetryEventSignup.send();
                }
            } catch {
                void window.showErrorMessage('Sign up request for OpenShift Sandbox failed, please try again.');
                telemetryEventSignup.sendError('Sign up request for OpenShift Sandbox timed out.');
            }
            break;
        }
        case 'sandboxLoginRequest': {
            const telemetryEventLogin = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.sandboxLoginRequest');
            try {
                const session: AuthenticationSession = await authentication.getSession('redhat-account-auth', ['openid'], { createIfNone: true });
                if (session) {
                    await panel.webview.postMessage({action: 'sandboxPageDetectStatus'});
                } else {
                    await panel.webview.postMessage({action: 'sandboxPageLoginRequired'});
                }
                telemetryEventLogin.send();
            } catch {
                await panel.webview.postMessage({action: 'sandboxPageLoginRequired'});
                telemetryEventLogin.sendError('Request for authentication session failed.');
            }
            break;
        }
        case 'sandboxDetectStatus': {
            const telemetryEventDetect = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.sandboxDetectStatus');
            try {
                const signupStatus = await sandboxAPI.getSignUpStatus((sessionCheck as any).idToken);
                if (!signupStatus) {
                    // User does not signed up for sandbox, show sign up for sandbox page
                    await panel.webview.postMessage({action: 'sandboxPageRequestSignup'});
                } else {
                    if (signupStatus.status.ready) {
                        const oauthInfo = await sandboxAPI.getOauthServerInfo(signupStatus.apiEndpoint);
                        const makeCoreV1ApiClient = ((proxy: string, username: string, accessToken: string): CoreV1Api => {
                            const kcu = Cluster.prepareSSOInKubeConfig(proxy, username, accessToken);
                            return kcu.makeApiClient(CoreV1Api);
                        });
                        const pipelineAccountToken = await Cluster.getPipelineServiceAccountToken(
                                makeCoreV1ApiClient(signupStatus.proxyURL, signupStatus.compliantUsername,
                                    (sessionCheck as any).idToken),
                                signupStatus.compliantUsername);
                        let errCode = '';
                        if (!pipelineAccountToken) { // Try loging in using a token from the Clipboard
                            if (!Cluster.validateLoginToken((await env.clipboard.readText()).trim())) {
                                errCode = 'invalidToken';
                            }
                        }
                        await panel.webview.postMessage({
                            action: 'sandboxPageProvisioned',
                            statusInfo: signupStatus.compliantUsername,
                            usePipelineToken: (pipelineAccountToken),
                            consoleDashboard: signupStatus.consoleURL,
                            apiEndpoint: signupStatus.apiEndpoint,
                            apiEndpointProxy: signupStatus.proxyURL,
                            oauthTokenEndpoint: oauthInfo.token_endpoint,
                            errorCode: errCode
                        });
                        if (!pipelineAccountToken) { // Try loging in using a token from the Clipboard
                            await pollClipboard(signupStatus);
                        }
                    } else {
                        // cluster is not ready and the reason is
                        if (signupStatus.status.verificationRequired) {
                            await panel.webview.postMessage({action: 'sandboxPageRequestVerificationCode'});
                        } else {
                            // user phone number verified
                            //
                            if (signupStatus.status.reason === 'PendingApproval') {
                                await panel.webview.postMessage({action: 'sandboxPageWaitingForApproval'});
                            } else {
                                await panel.webview.postMessage({action: 'sandboxPageWaitingForProvision'})
                            }
                        }
                    }
                }
                telemetryEventDetect.send();
            } catch {
                void window.showErrorMessage('OpenShift Sandbox status request timed out, please try again.');
                await panel.webview.postMessage({action: 'sandboxPageDetectStatus', errorCode: 'statusDetectionError'});
                telemetryEventDetect.sendError('OpenShift Sandbox status request timed out.');
            }
            break;
        }
        case 'sandboxRequestVerificationCode': {
            const telemetryEventRequestCode = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.sandboxRequestVerificationCode');
            try {
                const requestStatus = await sandboxAPI.requestVerificationCode((sessionCheck as any).idToken, event.payload.fullCountryCode, event.payload.rawPhoneNumber);
                if (requestStatus.ok) {
                    await panel.webview.postMessage({action: 'sandboxPageEnterVerificationCode'});
                    telemetryEventRequestCode.send();
                } else {
                    void window.showErrorMessage(`Request for verification code failed: ${requestStatus.json.details}`);
                    await panel.webview.postMessage({action: 'sandboxPageRequestVerificationCode'});
                    telemetryEventRequestCode.sendError('Request for verification code failed.');
                }
            } catch {
                void window.showErrorMessage('Request for verification code timed out, please try again.');
                await panel.webview.postMessage({action: 'sandboxPageRequestVerificationCode'});
                telemetryEventRequestCode.sendError('Request for verification code timed out.');
            }
            break;
        }
        case 'sandboxValidateVerificationCode': {
            const telemetryEventValidateCode = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.sandboxValidateVerificationCode');
            try {
                const requestStatus = await sandboxAPI.validateVerificationCode((sessionCheck as any).idToken, event.payload.verificationCode);
                if (requestStatus) {
                    await panel.webview.postMessage({action: 'sandboxPageDetectStatus'});
                    telemetryEventValidateCode.send();
                } else {
                    void window.showErrorMessage('Verification code does not match, please try again.');
                    await panel.webview.postMessage({action: 'sandboxPageEnterVerificationCode', errorCode: 'verificationFailed'});
                    telemetryEventValidateCode.sendError('Verification code does not match');
                }
            } catch {
                void window.showErrorMessage('Verification code validation request timed out, please try again.');
                await panel.webview.postMessage({action: 'sandboxPageEnterVerificationCode', errorCode: 'verificationFailed'});
                telemetryEventValidateCode.sendError('Verification code validation request failed');
            }
            break;
        }
        case 'sandboxLoginUsingDataInClipboard': {
            const telemetryEventLoginToSandbox = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.sandboxLoginUsingDataInClipboard');
            try {
                const result = await Cluster.loginUsingClipboardToken(event.payload.apiEndpointUrl, event.payload.oauthRequestTokenUrl);
                if (result) void window.showInformationMessage(`${result}`);
                telemetryEventLoginToSandbox.send();
            } catch (err) {
                void window.showErrorMessage(err.message);
                telemetryEventLoginToSandbox.sendError('Login into Sandbox Cluster failed.');
            }
            break;
        }
        case 'sandboxLoginUsingPipelineToken': {
            const telemetryEventLoginToSandbox = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.sandboxLoginUsingPipelineToken');
            try {
                const result = await Cluster.loginUsingPipelineServiceAccountToken(
                    event.payload.apiEndpointUrl,
                    event.payload.apiEndpointProxy,
                    event.payload.username,
                    (sessionCheck as any).idToken
                );
                if (result) void window.showInformationMessage(`${result}`);
                telemetryEventLoginToSandbox.send();
            } catch (err) {
                void window.showErrorMessage(err.message);
                telemetryEventLoginToSandbox.sendError('Login into Sandbox Cluster failed.');
            }
            break;
        }
        default:
            void window.showErrorMessage(`Unexpected message from webview: '${event.action}'`);
            break;
    }
}

async function pollClipboard(signupStatus) {
    const oauthInfo = await sandboxAPI.getOauthServerInfo(signupStatus.apiEndpoint);
    let firstPoll = true;
    while (panel) {
        const previousContent = (await env.clipboard.readText()).trim();
        await new Promise(r => setTimeout(r, 500));
        const currentContent = (await env.clipboard.readText()).trim();
        if (firstPoll || (previousContent && previousContent !== currentContent)) {
            firstPoll = false;
            let errCode = '';
            if (!Cluster.validateLoginToken(currentContent)){
                errCode = 'invalidToken';
            }
            void panel.webview.postMessage({
                    action: 'sandboxPageProvisioned',
                    statusInfo: signupStatus.username,
                    usePipelineToken: false,
                    consoleDashboard: signupStatus.consoleURL,
                    apiEndpoint: signupStatus.apiEndpoint,
                    apiEndpointProxy: signupStatus.proxyURL,
                    oauthTokenEndpoint: oauthInfo.token_endpoint,
                    errorCode: errCode
                });
        }
    }
}

export default class ClusterViewLoader implements Disposable {
    private static instance: ClusterViewLoader;

    public static getInstance(): ClusterViewLoader {
        if (!ClusterViewLoader.instance) {
            ClusterViewLoader.instance = new ClusterViewLoader();
        }
        return ClusterViewLoader.instance;
    }

    dispose() { }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    static get extensionPath() {
        return extensions.getExtension(ExtensionID).extensionPath
    }

    @vsCommand('openshift.explorer.addCluster.openLaunchSandboxPage')
    static async openLaunchSandboxPage(url: string) {
        // fake command to report crc selection through telemetry
    }

    @vsCommand('openshift.explorer.addCluster.openCreateClusterPage')
    static async openCreateClusterPage(url: string) {
        // fake command to report crc selection through telemetry
    }

    @vsCommand('openshift.explorer.addCluster.openCrcAddClusterPage')
    static async openCrcAddClusterPage() {
        const toolsJsonPath = Uri.file(path.join(ClusterViewLoader.extensionPath, 'src/tools.json'));
        let crc: string, crcOpenShift: string;
        try {
            const content = fs.readFileSync(toolsJsonPath.fsPath, { encoding: 'utf-8' });
            const json = JSON.parse(content);
            crc = json.crc.crcVersion;
            crcOpenShift = json.crc.openshiftVersion;
        } catch (err) {
            const telemetryEventLoginToSandbox = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.openCrcAddClusterPage');
            crc = '';
            crcOpenShift = '';
            void window.showErrorMessage(err.message);
            telemetryEventLoginToSandbox.sendError('Unable to fetch CRC and OpenshiftCRC version');
        } finally {
            await panel.webview.postMessage(
                {
                    action: 'openCrcAddClusterPage',
                    crc,
                    openShiftCRC: crcOpenShift
                });
        }

        // fake command to report crc selection through telemetry
    }

    @vsCommand('openshift.explorer.addCluster.crcSetup')
    static async crcSetup(event: any) {
        await OpenShiftTerminalManager.getInstance().executeInTerminal(new CommandText(`${event.data.tool}`, 'setup'), undefined, 'OpenShift Local Setup');
    }

    @vsCommand('openshift.explorer.addCluster.crcStart')
    static crcStart(event: any): Promise<void> {
        let startProcess: ChildProcess;
        channel.show();
        if (event.isSetting) {
            const binaryFromSetting: string = workspace.getConfiguration('openshiftToolkit').get('crcBinaryLocation');
            const pullSecretFromSetting: string = workspace.getConfiguration('openshiftToolkit').get('crcPullSecretPath');
            const cpuFromSetting: string = workspace.getConfiguration('openshiftToolkit').get('crcCpuCores');
            const memoryFromSetting: string = workspace.getConfiguration('openshiftToolkit').get('crcMemoryAllocated');
            const nameserver = workspace.getConfiguration('openshiftToolkit').get<string>('crcNameserver');
            const nameserverOption = nameserver ? ['-n', nameserver] : [];
            const crcOptions = ['start', '-p', `${pullSecretFromSetting}`, '-c', `${cpuFromSetting}`, '-m', `${memoryFromSetting}`, ...nameserverOption,  '-o', 'json'];

            startProcess = spawn(`${binaryFromSetting}`, crcOptions);
            channel.append(`\n\n"${binaryFromSetting}" ${crcOptions.join(' ')}\n`);
        } else {
            startProcess = spawn(`${event.data.tool}`, event.data.options.split(' '));
            channel.append(`\n\n"${event.data.tool}" ${event.data.options}\n`);
        }
        startProcess.stdout.setEncoding('utf8');
        startProcess.stderr.setEncoding('utf8');
        startProcess.stdout.on('data', (chunk) => {
            channel.append(chunk);
        });
        startProcess.stderr.on('data', (chunk) => {
            channel.append(chunk);
        });
        startProcess.on('close', (code) => {
            const message = `'crc start' exited with code ${code}`;
            channel.append(message);
            if (code !== 0) {
                void window.showErrorMessage(message);
            }
            const binaryLoc = event.isSetting ? workspace.getConfiguration('openshiftToolkit').get('crcBinaryLocation'): event.crcLoc;
            void ClusterViewLoader.checkCrcStatus(binaryLoc, 'crcstartstatus', panel);
        });
        startProcess.on('error', (err) => {
            const message = `'crc start' execution failed with error: '${err.message}'`;
            channel.append(message);
            void window.showErrorMessage(message);
        });
        return Promise.resolve();
    }

    @vsCommand('openshift.explorer.addCluster.crcStop')
    static crcStop(event): Promise<void> {
        let filePath: string;
        channel.show();
        if (event.data.tool === '') {
            filePath = workspace.getConfiguration('openshiftToolkit').get('crcBinaryLocation');
        } else {
            filePath = event.data.tool;
        }
        const stopProcess = spawn(`${filePath}`, ['stop']);
        channel.append(`\n\n"${filePath}" stop\n`);
        stopProcess.stdout.setEncoding('utf8');
        stopProcess.stderr.setEncoding('utf8');
        stopProcess.stdout.on('data', (chunk) => {
            channel.append(chunk);
        });
        stopProcess.stderr.on('data', (chunk) => {
            channel.append(chunk);
        });
        stopProcess.on('close', (code) => {
            const message = `'crc stop' exited with code ${code}`;
            channel.append(message);
            if (code !== 0) {
                void window.showErrorMessage(message);
            }
            void ClusterViewLoader.checkCrcStatus(filePath, 'crcstopstatus', panel);
        });
        stopProcess.on('error', (err) => {
            const message = `'crc stop' execution filed with error: '${err.message}'`;
            channel.append(message);
            void window.showErrorMessage(message);
        });
        return Promise.resolve();
    }

    @vsCommand('openshift.explorer.addCluster')
    static async add(value: string): Promise<void> {
        const webViewPanel: WebviewPanel = await ClusterViewLoader.loadView('Add OpenShift Cluster');
        if(value?.length > 0){
            await webViewPanel.webview.postMessage({action: 'cluster', param: value});
        }
    }

    /**
     * Cleans up the CRC configuration settings.
     *
     * This is a workarount to https://github.com/redhat-developer/vscode-openshift-tools/issues/4411
     * After the CRC setting values are removed, if the 'openshiftToolkit' object exists in 'settings.json',
     * containing the same settings as the CRC ones, the new values will be written AFTER the mensioned object,
     * so their values will override the ones defined in the object.
     */
    static async clearCrcSettings() {
        const cfg = workspace.getConfiguration('openshiftToolkit');
        await cfg.update('crcBinaryLocation', undefined, ConfigurationTarget.Global);
        await cfg.update('crcPullSecretPath', undefined, ConfigurationTarget.Global);
        await cfg.update('crcCpuCores', undefined, ConfigurationTarget.Global);
        await cfg.update('crcMemoryAllocated', undefined, ConfigurationTarget.Global);
        await cfg.update('crcNameserver', undefined); // Previously it was saved as `Workspace`
        await cfg.update('crcNameserver', undefined, ConfigurationTarget.Global);
    }

    static async crcSaveSettings(event) {
        await ClusterViewLoader.clearCrcSettings();
        const cfg = workspace.getConfiguration('openshiftToolkit');
        await cfg.update('crcBinaryLocation', event.crcLoc, ConfigurationTarget.Global);
        await cfg.update('crcPullSecretPath', event.pullSecret, ConfigurationTarget.Global);
        await cfg.update('crcCpuCores', event.cpuSize, ConfigurationTarget.Global);
        await cfg.update('crcMemoryAllocated', Number.parseInt(event.memory, 10), ConfigurationTarget.Global);
        await cfg.update('crcNameserver', event.nameserver, ConfigurationTarget.Global);
    }

    static async loadView(title: string): Promise<WebviewPanel> {
        const localResourceRoot = Uri.file(path.join(ClusterViewLoader.extensionPath, 'out'));
        if (panel) {
            // If we already have a panel, show it in the target column
            panel.reveal(ViewColumn.One);
        } else {
            panel = window.createWebviewPanel('clusterView', title, ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true
            });
            panel.iconPath = Uri.file(path.join(ClusterViewLoader.extensionPath, 'images/context/cluster-node.png'));
            panel.webview.html = await loadWebviewHtml('cluster', panel);
            const messageListenerDisposable = panel.webview.onDidReceiveMessage(clusterEditorMessageListener);
            panel.onDidDispose(()=> {
                messageListenerDisposable.dispose();
                panel = undefined;
            });
            // don't await this message being sent, since the webview may not be set up yet
            void panel.webview.postMessage({action: 'cluster', data: ''});
        }
        return panel;
    }

    public static async checkCrcStatus(filePath: string, postCommand: string, p: WebviewPanel | undefined = undefined) {
        const crcCredArray = [];
        const crcVerInfo = await ChildProcessUtil.Instance.execute(`"${filePath}" version -o json`);
        channel.append(`\n\n"${filePath}" version -o json\n`);
        channel.append(crcVerInfo.stdout);
        const result =  await ChildProcessUtil.Instance.execute(`"${filePath}" status -o json`);
        channel.append(`\n\n"${filePath}" status -o json\n`);
        channel.append(result.stdout);
        if (result.error || crcVerInfo.error) {
            await p.webview.postMessage({action: postCommand, errorStatus: true});
        } else {
            await p.webview.postMessage({
                action: postCommand,
                status: JSON.parse(result.stdout),
                errorStatus: false,
                versionInfo: JSON.parse(crcVerInfo.stdout),
                creds: crcCredArray
            });
        }
        const crcCreds = await ChildProcessUtil.Instance.execute(`"${filePath}" console --credentials -o json`);
        if (!crcCreds.error) {
            try {
                crcCredArray.push(JSON.parse(crcCreds.stdout).clusterConfig);
            } catch {
                // show error message?
            }
        }
    }
}
