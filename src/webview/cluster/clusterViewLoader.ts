/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { ExtenisonID } from '../../util/constants';
import { WindowUtil } from '../../util/windowUtils';
import { CliChannel } from '../../cli';
import { vsCommand } from '../../vscommand';
import { createSandboxAPI } from '../../openshift/sandbox';
import { ExtCommandTelemetryEvent } from '../../telemetry';
import { Cluster } from '../../openshift/cluster';

let panel: vscode.WebviewPanel;

const channel: vscode.OutputChannel = vscode.window.createOutputChannel('OpenShift Local Logs');
const sandboxAPI = createSandboxAPI();

async function clusterEditorMessageListener (event: any ): Promise<any> {

    let sessionCheck: vscode.AuthenticationSession;
    if (event.action?.startsWith('sandbox')) {
        sessionCheck = await vscode.authentication.getSession('redhat-account-auth', ['openid'], { createIfNone: false });
        if(!sessionCheck && event.action !== 'sandboxLoginRequest') {
            panel.webview.postMessage({action: 'sandboxPageLoginRequired'});
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
            ClusterViewLoader.crcSaveSettings(event);
            break;

        case 'checksetting':
            const binaryFromSetting:string = vscode.workspace.getConfiguration('openshiftConnector').get('crcBinaryLocation');
            if (binaryFromSetting) {
                panel.webview.postMessage({action: 'crcsetting'});
                ClusterViewLoader.checkCrcStatus(binaryFromSetting, 'crcstatus', panel);
            }
            break;

        case 'checkcrcstatus':
            ClusterViewLoader.checkCrcStatus(event.data, 'crcstatus', panel);
            break

        case 'crcLogin':
            vscode.commands.executeCommand(
                'openshift.explorer.login.credentialsLogin',
                true,
                event.url,
                event.data.username,
                event.data.password
            );
            break;
        case 'sandboxCheckAuthSession':
            panel.webview.postMessage({action: 'sandboxPageDetectStatus'});
            break;
        case 'sandboxRequestSignup':
            const telemetryEventSignup = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.sandboxRequestSignup');
            try {
                const signupResponse = await sandboxAPI.signUp((sessionCheck as any).idToken);
                panel.webview.postMessage({action: 'sandboxPageDetectStatus'});
                if (!signupResponse) {
                    vscode.window.showErrorMessage('Sign up request for OpenShift Sandbox failed, please try again.');
                    telemetryEventSignup.sendError('Sign up request for OpenShift Sandbox failed.');
                } else {
                    telemetryEventSignup.send();
                }
            } catch(ex) {
                vscode.window.showErrorMessage('Sign up request for OpenShift Sandbox failed, please try again.');
                telemetryEventSignup.sendError('Sign up request for OpenShift Sandbox timed out.');
            }
            break;
        case 'sandboxLoginRequest':
            const telemetryEventLogin = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.sandboxLoginRequest');
            try {
                const session: vscode.AuthenticationSession = await vscode.authentication.getSession('redhat-account-auth', ['openid'], { createIfNone: true });
                if (session) {
                    panel.webview.postMessage({action: 'sandboxPageDetectStatus'});
                } else {
                    panel.webview.postMessage({action: 'sandboxPageLoginRequired'});
                }
                telemetryEventLogin.send();
            } catch (ex) {
                panel.webview.postMessage({action: 'sandboxPageLoginRequired'});
                telemetryEventLogin.sendError('Request for authentication session failed.');
            }
            break;
        case 'sandboxDetectStatus':
            const telemetryEventDetect = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.sandboxDetectStatus');
            try {
                const signupStatus = await sandboxAPI.getSignUpStatus((sessionCheck as any).idToken);
                if (!signupStatus) {
                    // User does not signed up for sandbox, show sign up for sandbox page
                    panel.webview.postMessage({action: 'sandboxPageRequestSignup'});
                } else {
                    if (signupStatus.status.ready) {
                        panel.webview.postMessage({action: 'sandboxPageProvisioned', statusInfo: signupStatus.username, consoleDashboard: signupStatus.consoleURL });
                    } else {
                        // cluster is not ready and the reason is
                        if (signupStatus.status.verificationRequired) {
                            panel.webview.postMessage({action: 'sandboxPageRequestVerificationCode'});
                        } else {
                            // user phone number verified
                            //
                            if (signupStatus.status.reason === 'PendingApproval') {
                                panel.webview.postMessage({action: 'sandboxPageWaitingForApproval'});
                            } else if (signupStatus.status.reason === 'Provisioned') {
                                panel.webview.postMessage({action: 'sandboxPageProvisioned', statusInfo: signupStatus.username, consoleDashboard: signupStatus.consoleURL});
                            } else {
                                panel.webview.postMessage({action: 'sandboxPageWaitingForProvision'})
                            }
                        }
                    }
                }
                telemetryEventDetect.send();
            } catch(ex) {
                vscode.window.showErrorMessage('OpenShift Sandbox status request timed out, please try again.');
                panel.webview.postMessage({action: 'sandboxPageDetectStatus', errorCode: 'statusDetectionError'});
                telemetryEventDetect.sendError('OpenShift Sandbox status request timed out.');
            }
            break;
        case 'sandboxRequestVerificationCode': {
            const telemetryEventRequestCode = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.sandboxRequestVerificationCode');
            try {
                const requestStatus = await sandboxAPI.requestVerificationCode((sessionCheck as any).idToken, event.payload.fullCountryCode, event.payload.rawPhoneNumber);
                if (requestStatus.ok) {
                    panel.webview.postMessage({action: 'sandboxPageEnterVerificationCode'});
                    telemetryEventRequestCode.send();
                } else {
                    vscode.window.showErrorMessage(`Request for verification code failed: ${requestStatus.json.details}`);
                    panel.webview.postMessage({action: 'sandboxPageRequestVerificationCode'});
                    telemetryEventRequestCode.sendError('Request for verification code failed.');
                }
            } catch (ex) {
                vscode.window.showErrorMessage('Request for verification code timed out, please try again.');
                panel.webview.postMessage({action: 'sandboxPageRequestVerificationCode'});
                telemetryEventRequestCode.sendError('Request for verification code timed out.');
            }
            break;
        }
        case 'sandboxValidateVerificationCode': {
            const telemetryEventValidateCode = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.sandboxValidateVerificationCode');
            try {
                const requestStatus = await sandboxAPI.validateVerificationCode((sessionCheck as any).idToken, event.payload.verificationCode);
                if (requestStatus) {
                    panel.webview.postMessage({action: 'sandboxPageDetectStatus'});
                    telemetryEventValidateCode.send();
                } else {
                    vscode.window.showErrorMessage('Verification code does not match, please try again.');
                    panel.webview.postMessage({action: 'sandboxPageEnterVerificationCode', errorCode: 'verificationFailed'});
                    telemetryEventValidateCode.sendError('Verification code does not match');
                }
            } catch(ex) {
                vscode.window.showErrorMessage('Verification code validation request timed out, please try again.');
                panel.webview.postMessage({action: 'sandboxPageEnterVerificationCode', errorCode: 'verificationFailed'});
                telemetryEventValidateCode.sendError('Verification code validation request failed');
            }
            break;
        }
        case 'sandboxLoginUsingDataInClipboard':
            const telemetryEventLoginToSandbox = new ExtCommandTelemetryEvent('openshift.explorer.addCluster.sandboxLoginUsingDataInClipboard');
            try {
                const result = await Cluster.loginUsingClipboardInfo(event.payload.url);
                if (result) vscode.window.showInformationMessage(`${result}`);
                telemetryEventLoginToSandbox.send();
            } catch (err) {
                vscode.window.showErrorMessage(err.message);
                telemetryEventLoginToSandbox.sendError('Login into Sandbox Cluster failed.');
            }
            break;
    }
}

export default class ClusterViewLoader {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    static get extensionPath() {
        return vscode.extensions.getExtension(ExtenisonID).extensionPath
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
        // fake command to report crc selection through telemetry
    }

    @vsCommand('openshift.explorer.addCluster.crcSetup')
    static async crcSetup(event: any) {
        const terminal: vscode.Terminal = WindowUtil.createTerminal('OpenShift: CRC Setup', undefined);
        terminal.sendText(`"${event.data.tool}" setup`);
        terminal.show();
    }

    @vsCommand('openshift.explorer.addCluster.crcStart')
    static async crcStart(event: any) {
        let startProcess: ChildProcess;
        channel.show();
        if (event.isSetting) {
            const binaryFromSetting = vscode.workspace.getConfiguration('openshiftConnector').get('crcBinaryLocation');
            const pullSecretFromSetting = vscode.workspace.getConfiguration('openshiftConnector').get('crcPullSecretPath');
            const cpuFromSetting = vscode.workspace.getConfiguration('openshiftConnector').get('crcCpuCores');
            const memoryFromSetting = vscode.workspace.getConfiguration('openshiftConnector').get('crcMemoryAllocated');
            const nameserver = vscode.workspace.getConfiguration('openshiftConnector').get<string>('crcNameserver');
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
                vscode.window.showErrorMessage(message);
            }
            const binaryLoc = event.isSetting ? vscode.workspace.getConfiguration('openshiftConnector').get('crcBinaryLocation'): event.crcLoc;
            ClusterViewLoader.checkCrcStatus(binaryLoc, 'crcstartstatus', panel);
        });
        startProcess.on('error', (err) => {
            const message = `'crc start' execution failed with error: '${err.message}'`;
            channel.append(message);
            vscode.window.showErrorMessage(message);
        });
    }

    @vsCommand('openshift.explorer.addCluster.crcStop')
    static async crcStop(event) {
        let filePath: string;
        channel.show();
        if (event.data.tool === '') {
            filePath = vscode.workspace.getConfiguration('openshiftConnector').get('crcBinaryLocation');
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
                vscode.window.showErrorMessage(message);
            }
            ClusterViewLoader.checkCrcStatus(filePath, 'crcstopstatus', panel);
        });
        stopProcess.on('error', (err) => {
            const message = `'crc stop' execution filed with error: '${err.message}'`;
            channel.append(message);
            vscode.window.showErrorMessage(message);
        });
    }

    static async crcSaveSettings(event) {
        const cfg = vscode.workspace.getConfiguration('openshiftConnector');
        await cfg.update('crcBinaryLocation', event.crcLoc, vscode.ConfigurationTarget.Global);
        await cfg.update('crcPullSecretPath', event.pullSecret, vscode.ConfigurationTarget.Global);
        await cfg.update('crcCpuCores', event.cpuSize, vscode.ConfigurationTarget.Global);
        await cfg.update('crcMemoryAllocated', Number.parseInt(event.memory, 10), vscode.ConfigurationTarget.Global);
        await cfg.update('crcNameserver', event.nameserver);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    static async loadView(title: string): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(ClusterViewLoader.extensionPath, 'out', 'clusterViewer'));
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
            panel.webview.html = ClusterViewLoader.getWebviewContent(ClusterViewLoader.extensionPath, panel);
            panel.webview.postMessage({action: 'cluster', data: ''});
            panel.onDidDispose(()=> {
                panel = undefined;
            });
            panel.webview.onDidReceiveMessage(clusterEditorMessageListener);
        }
        return panel;
    }

    public static async checkCrcStatus(filePath: string, postCommand: string, p: vscode.WebviewPanel | undefined = undefined) {
        const crcCredArray = [];
        const crcVerInfo = await CliChannel.getInstance().execute(`"${filePath}" version -o json`);
        channel.append(`\n\n"${filePath}" version -o json\n`);
        channel.append(crcVerInfo.stdout);
        const result =  await CliChannel.getInstance().execute(`"${filePath}" status -o json`);
        channel.append(`\n\n"${filePath}" status -o json\n`);
        channel.append(result.stdout);
        if (result.error || crcVerInfo.error) {
            p.webview.postMessage({action: postCommand, errorStatus: true});
        } else {
            p.webview.postMessage({
                action: postCommand,
                status: JSON.parse(result.stdout),
                errorStatus: false,
                versionInfo: JSON.parse(crcVerInfo.stdout),
                creds: crcCredArray
            });
        }
        const crcCreds = await CliChannel.getInstance().execute(`"${filePath}" console --credentials -o json`);
        if (!crcCreds.error) {
            try {
                crcCredArray.push(JSON.parse(crcCreds.stdout).clusterConfig);
            } catch(err) {
                // show error message?
            }
        }
    }

    private static getWebviewContent(extensionPath: string, p: vscode.WebviewPanel): string {
        // Local path to main script run in the webview
        const reactAppRootOnDisk = path.join(extensionPath, 'out', 'clusterViewer');
        const reactAppPathOnDisk = vscode.Uri.file(
            path.join(reactAppRootOnDisk, 'clusterViewer.js'),
        );
        const reactAppUri = p.webview.asWebviewUri(reactAppPathOnDisk);
        const htmlString:Buffer = fs.readFileSync(path.join(reactAppRootOnDisk, 'index.html'));
        const meta = `<meta http-equiv="Content-Security-Policy"
            content="connect-src *;
            default-src 'none';
            img-src ${p.webview.cspSource} https: 'self' data:;
            script-src 'unsafe-eval' 'unsafe-inline' vscode-resource:;
            style-src 'self' vscode-resource: 'unsafe-inline';">`;
        return `${htmlString}`
            .replace('%COMMAND%', '')
            .replace('%PLATFORM%', process.platform)
            .replace('clusterViewer.js',`${reactAppUri}`)
            .replace('%BASE_URL%', `${reactAppUri}`)
            .replace('<!-- meta http-equiv="Content-Security-Policy" -->', meta);
    }
}