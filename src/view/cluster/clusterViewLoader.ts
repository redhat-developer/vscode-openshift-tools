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

let panel: vscode.WebviewPanel;

export default class ClusterViewLoader {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    static get extensionPath() {
        return vscode.extensions.getExtension(ExtenisonID).extensionPath
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    static async loadView(title: string): Promise<vscode.WebviewPanel> {

        let startProcess: ChildProcess;
        let stopProcess: ChildProcess;
        const channel: vscode.OutputChannel = vscode.window.createOutputChannel('CRC Logs');
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
        }
        panel.iconPath = vscode.Uri.file(path.join(ClusterViewLoader.extensionPath, "images/context/cluster-node.png"));
        panel.webview.html = ClusterViewLoader.getWebviewContent(ClusterViewLoader.extensionPath, panel);
        panel.webview.postMessage({action: 'cluster', data: ''});
        panel.onDidDispose(()=> {
            panel = undefined;
        });
        panel.webview.onDidReceiveMessage(async (event)  => {
            const timestamp = Number(new Date());
            const date = new Date(timestamp);
            if (event.action === 'run') {
                const terminal: vscode.Terminal = WindowUtil.createTerminal(`OpenShift: CRC Setup`, undefined);
                terminal.sendText(`${event.data} setup`);
                terminal.show();
            }
            if (event.action === 'start') {
                channel.show();
                channel.append(`\nStarting Red Hat CodeReady Containers from webview at ${date}\n`);
                if (event.isSetting) {
                    const binaryFromSetting= vscode.workspace.getConfiguration("openshiftConnector").get("crcBinaryLocation");
                    const pullSecretFromSetting= vscode.workspace.getConfiguration("openshiftConnector").get("crcPullSecretPath");
                    const cpuFromSetting= vscode.workspace.getConfiguration("openshiftConnector").get("crcCpuCores");
                    const memoryFromSetting= vscode.workspace.getConfiguration("openshiftConnector").get("crcMemoryAllocated");
                    startProcess = spawn(`${binaryFromSetting}`, ['start', '-p', `${pullSecretFromSetting}`, '-c', `${cpuFromSetting}`, '-m', `${memoryFromSetting}`, '-ojson']);
                } else {
                    const configuration = vscode.workspace.getConfiguration("openshiftConnector");
                    configuration.update("crcBinaryLocation", event.crcLoc, vscode.ConfigurationTarget.Global);
                    configuration.update("crcPullSecretPath", event.pullSecret, vscode.ConfigurationTarget.Global);
                    configuration.update("crcCpuCores", event.cpuSize, vscode.ConfigurationTarget.Global);
                    configuration.update("crcMemoryAllocated", Number.parseInt(event.memory), vscode.ConfigurationTarget.Global);
                    const [tool, ...params] = event.data.split(' ');
                    startProcess = spawn(tool, params);
                }
                startProcess.stdout.setEncoding('utf8');
                startProcess.stderr.setEncoding('utf8');
                startProcess.stdout.on('data', (chunk) => {
                    channel.append(chunk);
                });
                startProcess.stderr.on('data', (chunk) => {
                    channel.append(chunk);
                });
                startProcess.on('close', async (code) => {
                    // eslint-disable-next-line no-console
                    console.log(`crc start exited with code ${code}`);
                    if (code!= 0) {
                        panel.webview.postMessage({action: 'sendcrcstarterror'})
                    }
                    const binaryLoc = event.isSetting ? vscode.workspace.getConfiguration("openshiftConnector").get("crcBinaryLocation"): event.crcLoc;
                    ClusterViewLoader.checkCrcStatus(binaryLoc, 'crcstartstatus', panel);
                });
            }
            if (event.action === 'stop') {
                let filePath: string;
                channel.show();
                channel.append(`\nStopping Red Hat CodeReady Containers from webview at ${date}\n`);
                if (event.data === '') {
                    filePath = vscode.workspace.getConfiguration("openshiftConnector").get("crcBinaryLocation");
                } else filePath = event.data;
                stopProcess = spawn(`${filePath}`, ['stop']);
                stopProcess.stdout.setEncoding('utf8');
                stopProcess.stderr.setEncoding('utf8');
                stopProcess.stdout.on('data', (chunk) => {
                    channel.append(chunk);
                });
                stopProcess.stderr.on('data', (chunk) => {
                    channel.append(chunk);
                });
                stopProcess.on('close', async (code) => {
                    // eslint-disable-next-line no-console
                    console.log(`crc stop exited with code ${code}`);
                    ClusterViewLoader.checkCrcStatus(filePath, 'crcstopstatus', panel);
                });
            }
            if (event.action === 'checksetting') {
                const binaryFromSetting:string = vscode.workspace.getConfiguration("openshiftConnector").get("crcBinaryLocation");
                if (binaryFromSetting) {
                    panel.webview.postMessage({action: 'crcsetting'});
                    ClusterViewLoader.checkCrcStatus(binaryFromSetting, 'crcstatus', panel);
                }
            }
            if (event.action === 'checkcrcstatus') {
                ClusterViewLoader.checkCrcStatus(event.data, 'crcstatus', panel);
            }

            if (event.action === 'crclogin') {
                vscode.commands.executeCommand(
                    'openshift.explorer.login.credentialsLogin',
                    true,
                    event.url,
                    event.data.username,
                    event.data.password
                );
            }
        })
        return panel;
    }

    private static async checkCrcStatus(filePath: string, postCommand: string, panel: vscode.WebviewPanel | undefined = undefined) {
        let crcCredArray = [];
        const crcVerInfo = await CliChannel.getInstance().execute(`${filePath} version -ojson`);
        const result =  await CliChannel.getInstance().execute(`${filePath} status -ojson`);
        if (result.stderr || crcVerInfo.stderr) {
            panel.webview.postMessage({action: postCommand, errorStatus: true});
        } else {
            panel.webview.postMessage({
                action: postCommand,
                status: JSON.parse(result.stdout),
                errorStatus: false,
                versionInfo: JSON.parse(crcVerInfo.stdout),
                creds: crcCredArray
            });
        }
        const crcCreds = await CliChannel.getInstance().execute(`${filePath} console --credentials -ojson`);
        if (!crcCreds.error) {
            try {
                crcCredArray.push(JSON.parse(crcCreds.stdout).clusterConfig);
            } catch(err) {
                // show error message?
            }
        }
    }

    private static getWebviewContent(extensionPath: string, panel: vscode.WebviewPanel): string {
        // Local path to main script run in the webview
        const reactAppRootOnDisk = path.join(extensionPath, 'out', 'clusterViewer');
        const reactAppPathOnDisk = vscode.Uri.file(
            path.join(reactAppRootOnDisk, 'clusterViewer.js'),
        );
        const reactAppUri = panel.webview.asWebviewUri(reactAppPathOnDisk);
        const htmlString:Buffer = fs.readFileSync(path.join(reactAppRootOnDisk, 'index.html'));
        const meta = `<meta http-equiv="Content-Security-Policy"
        content="connect-src *;
            default-src 'none';
            img-src ${panel.webview.cspSource} https: 'self' data:;
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
