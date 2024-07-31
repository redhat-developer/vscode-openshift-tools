/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { clearInterval } from 'timers';
import * as vscode from 'vscode';
import { CommandText } from '../../base/command';
import { Oc } from '../../oc/ocWrapper';
import { Cluster } from '../../openshift/cluster';
import { createSandboxAPI } from '../../openshift/sandbox';
import { ExtCommandTelemetryEvent } from '../../telemetry';
import { ChildProcessUtil } from '../../util/childProcessUtil';
import { ExtensionID } from '../../util/constants';
import { KubeConfigUtils } from '../../util/kubeUtils';
import { vsCommand } from '../../vscommand';
import { loadWebviewHtml } from '../common-ext/utils';
import { OpenShiftTerminalManager } from '../openshift-terminal/openShiftTerminal';

let panel: vscode.WebviewPanel;

const channel: vscode.OutputChannel = vscode.window.createOutputChannel('OpenShift Local Logs');
const sandboxAPI = createSandboxAPI();

async function clusterEditorMessageListener (event: any ): Promise<any> {

    let sessionCheck: vscode.AuthenticationSession;
    if (event.action?.startsWith('sandbox')) {
        sessionCheck = await vscode.authentication.getSession('redhat-account-auth', ['openid'], { createIfNone: false });
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
            await vscode.commands.executeCommand(`openshift.explorer.addCluster.${event.action}`, event);
            break;

        case 'crcSaveSettings':
            void ClusterViewLoader.crcSaveSettings(event);
            break;

        case 'checksetting': {
            const binaryFromSetting: string = vscode.workspace.getConfiguration('openshiftToolkit').get('crcBinaryLocation');
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
            void vscode.commands.executeCommand(
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
                    void vscode.window.showErrorMessage('Sign up request for OpenShift Sandbox failed, please try again.');
                    telemetryEventSignup.sendError('Sign up request for OpenShift Sandbox failed.');
                } else {
                    telemetryEventSignup.send();
                }
            } catch(ex) {
                void vscode.window.showErrorMessage('Sign up request for OpenShift Sandbox failed, please try again.');
                telemetryEventSignup.sendError('Sign up request for OpenShift Sandbox timed out.');
            }
            break;
        }
        case 'sandboxLoginRequest': {
            const telemetryEventLogin = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.sandboxLoginRequest');
            try {
                const session: vscode.AuthenticationSession = await vscode.authentication.getSession('redhat-account-auth', ['openid'], { createIfNone: true });
                if (session) {
                    await panel.webview.postMessage({action: 'sandboxPageDetectStatus'});
                } else {
                    await panel.webview.postMessage({action: 'sandboxPageLoginRequired'});
                }
                telemetryEventLogin.send();
            } catch (ex) {
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
                        let errCode = '';
                        if (!Cluster.validateLoginToken((await vscode.env.clipboard.readText()).trim())) {
                            errCode = 'invalidToken';
                        }
                        await panel.webview.postMessage({ action: 'sandboxPageProvisioned', statusInfo: signupStatus.username, consoleDashboard: signupStatus.consoleURL, apiEndpoint: signupStatus.apiEndpoint, oauthTokenEndpoint: oauthInfo.token_endpoint, errorCode: errCode });
                        await pollClipboard(signupStatus);
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
            } catch (ex) {
                void vscode.window.showErrorMessage('OpenShift Sandbox status request timed out, please try again.');
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
                    void vscode.window.showErrorMessage(`Request for verification code failed: ${requestStatus.json.details}`);
                    await panel.webview.postMessage({action: 'sandboxPageRequestVerificationCode'});
                    telemetryEventRequestCode.sendError('Request for verification code failed.');
                }
            } catch (ex) {
                void vscode.window.showErrorMessage('Request for verification code timed out, please try again.');
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
                    void vscode.window.showErrorMessage('Verification code does not match, please try again.');
                    await panel.webview.postMessage({action: 'sandboxPageEnterVerificationCode', errorCode: 'verificationFailed'});
                    telemetryEventValidateCode.sendError('Verification code does not match');
                }
            } catch(ex) {
                void vscode.window.showErrorMessage('Verification code validation request timed out, please try again.');
                await panel.webview.postMessage({action: 'sandboxPageEnterVerificationCode', errorCode: 'verificationFailed'});
                telemetryEventValidateCode.sendError('Verification code validation request failed');
            }
            break;
        }
        case 'sandboxLoginUsingDataInClipboard': {
            const telemetryEventLoginToSandbox = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.sandboxLoginUsingDataInClipboard');
            try {
                const result = await Cluster.loginUsingClipboardToken(event.payload.apiEndpointUrl, event.payload.oauthRequestTokenUrl);
                if (result) void vscode.window.showInformationMessage(`${result}`);
                telemetryEventLoginToSandbox.send();
                const timeout = setInterval(() => {
                    const currentUser = new KubeConfigUtils().getCurrentUser();
                    if (currentUser) {
                        clearInterval(timeout);
                        const projectPrefix = currentUser.name.substring(
                            0,
                            currentUser.name.indexOf('/'),
                        );
                        void Oc.Instance.getProjects().then((projects) => {
                            const userProject = projects.find((project) =>
                                project.name.includes(projectPrefix),
                            );
                            void Oc.Instance.setProject(userProject.name);
                        });
                    }
                }, 1000);
            } catch (err) {
                void vscode.window.showErrorMessage(err.message);
                telemetryEventLoginToSandbox.sendError('Login into Sandbox Cluster failed.');
            }
            break;
        }
        default:
            void vscode.window.showErrorMessage(`Unexpected message from webview: '${event.action}'`);
            break;
    }
}

async function pollClipboard(signupStatus) {
    const oauthInfo = await sandboxAPI.getOauthServerInfo(signupStatus.apiEndpoint);
    let coldStart = true; // To enforce clipboard token propagation on start
    while (panel) {
        const previousContent = (await vscode.env.clipboard.readText()).trim();
        await new Promise(r => setTimeout(r, 500));
        const currentContent = (await vscode.env.clipboard.readText()).trim();
        if (coldStart || (previousContent && previousContent !== currentContent)) {
            coldStart = false;
            let errCode = '';
            if (!Cluster.validateLoginToken(currentContent)){
                errCode = 'invalidToken';
            }
            void panel.webview.postMessage({action: 'sandboxPageProvisioned', statusInfo: signupStatus.username, consoleDashboard: signupStatus.consoleURL, apiEndpoint: signupStatus.apiEndpoint, oauthTokenEndpoint: oauthInfo.token_endpoint, errorCode: errCode});
        }
    }
}

export default class ClusterViewLoader {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    static get extensionPath() {
        return vscode.extensions.getExtension(ExtensionID).extensionPath
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
        const toolsJsonPath = vscode.Uri.file(path.join(ClusterViewLoader.extensionPath, 'src/tools.json'));
        let crc: string, crcOpenShift: string;
        try {
            const content = fs.readFileSync(toolsJsonPath.fsPath, { encoding: 'utf-8' });
            const json = JSON.parse(content);
            crc = json.crc.crcVersion;
            crcOpenShift = json.crc.openshiftVersion;
        } catch (err) {
            const telemetryEventLoginToSandbox = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.openCrcAddClusterPage');
            crc = '',
            crcOpenShift = '';
            void vscode.window.showErrorMessage(err.message);
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
            const binaryFromSetting: string = vscode.workspace.getConfiguration('openshiftToolkit').get('crcBinaryLocation');
            const pullSecretFromSetting: string = vscode.workspace.getConfiguration('openshiftToolkit').get('crcPullSecretPath');
            const cpuFromSetting: string = vscode.workspace.getConfiguration('openshiftToolkit').get('crcCpuCores');
            const memoryFromSetting: string = vscode.workspace.getConfiguration('openshiftToolkit').get('crcMemoryAllocated');
            const nameserver = vscode.workspace.getConfiguration('openshiftToolkit').get<string>('crcNameserver');
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
                void vscode.window.showErrorMessage(message);
            }
            const binaryLoc = event.isSetting ? vscode.workspace.getConfiguration('openshiftToolkit').get('crcBinaryLocation'): event.crcLoc;
            void ClusterViewLoader.checkCrcStatus(binaryLoc, 'crcstartstatus', panel);
        });
        startProcess.on('error', (err) => {
            const message = `'crc start' execution failed with error: '${err.message}'`;
            channel.append(message);
            void vscode.window.showErrorMessage(message);
        });
        return Promise.resolve();
    }

    @vsCommand('openshift.explorer.addCluster.crcStop')
    static crcStop(event): Promise<void> {
        let filePath: string;
        channel.show();
        if (event.data.tool === '') {
            filePath = vscode.workspace.getConfiguration('openshiftToolkit').get('crcBinaryLocation');
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
                void vscode.window.showErrorMessage(message);
            }
            void ClusterViewLoader.checkCrcStatus(filePath, 'crcstopstatus', panel);
        });
        stopProcess.on('error', (err) => {
            const message = `'crc stop' execution filed with error: '${err.message}'`;
            channel.append(message);
            void vscode.window.showErrorMessage(message);
        });
        return Promise.resolve();
    }

    @vsCommand('openshift.explorer.addCluster')
    static async add(value: string): Promise<void> {
        const webViewPanel: vscode.WebviewPanel = await ClusterViewLoader.loadView('Add OpenShift Cluster');
        if(value?.length > 0){
            await webViewPanel.webview.postMessage({action: 'cluster', param: value});
        }
    }

    static async crcSaveSettings(event) {
        const cfg = vscode.workspace.getConfiguration('openshiftToolkit');
        await cfg.update('crcBinaryLocation', event.crcLoc, vscode.ConfigurationTarget.Global);
        await cfg.update('crcPullSecretPath', event.pullSecret, vscode.ConfigurationTarget.Global);
        await cfg.update('crcCpuCores', event.cpuSize, vscode.ConfigurationTarget.Global);
        await cfg.update('crcMemoryAllocated', Number.parseInt(event.memory, 10), vscode.ConfigurationTarget.Global);
        await cfg.update('crcNameserver', event.nameserver);
    }

    static async loadView(title: string): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(ClusterViewLoader.extensionPath, 'out'));
        if (panel) {
            // If we already have a panel, show it in the target column
            panel.reveal(vscode.ViewColumn.One);
        } else {
            panel = vscode.window.createWebviewPanel('clusterView', title, vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true
            });
            panel.iconPath = vscode.Uri.file(path.join(ClusterViewLoader.extensionPath, 'images/context/cluster-node.png'));
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

    public static async checkCrcStatus(filePath: string, postCommand: string, p: vscode.WebviewPanel | undefined = undefined) {
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
            } catch(err) {
                // show error message?
            }
        }
    }
}
