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

export default class ClusterViewLoader {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    static get extensionPath() {
        return vscode.extensions.getExtension(ExtenisonID).extensionPath
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    static async loadView(title: string): Promise<vscode.WebviewPanel> {
        let panel: vscode.WebviewPanel | undefined = undefined;
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
        panel.webview.html = ClusterViewLoader.getWebviewContent(ClusterViewLoader.extensionPath);
        panel.webview.postMessage({action: 'cluster', data: ''});
        panel.webview.onDidReceiveMessage(async (event)  => {
            const timestamp = Number(new Date());
            const date = new Date(timestamp);
            if (event.action === 'run') {
                const terminal: vscode.Terminal = WindowUtil.createTerminal(`OpenShift: Run CRC Setup`, undefined);
                terminal.sendText(`${event.data} setup`);
                terminal.show();
                vscode.workspace.getConfiguration("openshiftConnector").update("crcBinaryLocation", event.data);
            }
            if (event.action === 'start') {
                channel.show();
                channel.append(`\nStarting Red Hat Code Ready Containers from webview at ${date}\n`);
                if (event.isSetting) {
                    const binaryFromSetting= vscode.workspace.getConfiguration("openshiftConnector").get("crcBinaryLocation");
                    const pullSecretFromSetting= vscode.workspace.getConfiguration("openshiftConnector").get("crcPullSecretPath");
                    const cpuFromSetting= vscode.workspace.getConfiguration("openshiftConnector").get("crcCpuCores");
                    const memoryFromSetting= vscode.workspace.getConfiguration("openshiftConnector").get("crcMemoryAllocated");
                    startProcess = spawn(`${binaryFromSetting}`, ['start', '-p', `${pullSecretFromSetting}`, '-c', `${cpuFromSetting}`, '-m', `${memoryFromSetting}`]);
                } else {
                    const [tool, ...params] = event.data.split(' ');
                    startProcess = spawn(tool, params);
                }
                startProcess.stdout.setEncoding('utf8');
                startProcess.stderr.setEncoding('utf8');
                startProcess.stdout.on('data', (chunk) => {
                    channel.append(chunk);
                });
                startProcess.stderr.on('data', (chunk) => {
                    console.log(chunk);
                    channel.append(chunk);
                    panel.webview.postMessage({action: 'crcstarterror', data: chunk})
                });
                startProcess.on('close', async (code) => {
                    vscode.workspace.getConfiguration("openshiftConnector").update("crcPullSecretPath", event.pullSecret);
                    vscode.workspace.getConfiguration("openshiftConnector").update("crcCpuCores", event.cpuSize);
                    vscode.workspace.getConfiguration("openshiftConnector").update("crcMemoryAllocated", event.memory);
                    // eslint-disable-next-line no-console
                    console.log(`crc start exited with code ${code}`);
                    const result =  await CliChannel.getInstance().execute(`${event.crcLoc} status -ojson`);
                    panel.webview.postMessage({action: 'crcstartstatus', data: code, status: JSON.parse(result.stdout)})
                });
            }
            if (event.action === 'stop') {
                let filePath;
                channel.show();
                channel.append(`\nStopping Red Hat Code Ready Containers from webview at ${date}\n`);
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
                    panel.webview.postMessage({action: 'crcstoperror', data: chunk})
                });
                stopProcess.on('close', async (code) => {
                    // eslint-disable-next-line no-console
                    console.log(`crc stop exited with code ${code}`);
                    const result =  await CliChannel.getInstance().execute(`${filePath} status -ojson`);
                    panel.webview.postMessage({action: 'crcstopstatus', data: code, status: JSON.parse(result.stdout)})
                });
            }
            if (event.action === 'checksetting') {
                const binaryFromSetting= vscode.workspace.getConfiguration("openshiftConnector").get("crcBinaryLocation");
                if (binaryFromSetting) {
                    panel.webview.postMessage({action: 'crcsetting'});
                    const result =  await CliChannel.getInstance().execute(`${binaryFromSetting} status -ojson`);
                    panel.webview.postMessage({action: 'crcstatus', status: JSON.parse(result.stdout)});
                }
            }
            if (event.action === 'checkcrcstatus') {
                const result =  await CliChannel.getInstance().execute(`${event.data} status -ojson`);
                panel.webview.postMessage({action: 'crcstatus', status: JSON.parse(result.stdout)});
            }
        })
        return panel;
    }

    private static getWebviewContent(extensionPath: string): string {
        // Local path to main script run in the webview
        const reactAppRootOnDisk = path.join(extensionPath, 'out', 'clusterViewer');
        const reactAppPathOnDisk = vscode.Uri.file(
            path.join(reactAppRootOnDisk, 'clusterViewer.js'),
        );
        const reactAppUri = reactAppPathOnDisk.with({ scheme: 'vscode-resource' });
        const htmlString:Buffer = fs.readFileSync(path.join(reactAppRootOnDisk, 'index.html'));
        const meta = `<meta http-equiv="Content-Security-Policy"
        content="connect-src *;
            default-src 'none';
            img-src https:;
            script-src 'unsafe-eval' 'unsafe-inline' vscode-resource:;
            style-src vscode-resource: 'unsafe-inline';">`;
        return `${htmlString}`
            .replace('%COMMAND%', '')
            .replace('%PLATFORM%', process.platform)
            .replace('clusterViewer.js',`${reactAppUri}`)
            .replace('<!-- meta http-equiv="Content-Security-Policy" -->', meta);
    }
}
