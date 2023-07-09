/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionID } from '../../util/constants';
import { loadWebviewHtml } from '../common-ext/utils';
import { CliChannel, CliExitData } from '../../cli';
import { BuildAndDeploy } from '../../serveressFunction/build-run-deploy';
import { serverlessInstance } from '../../serveressFunction/functionImpl';
import { Progress } from '../../util/progress';
import { selectWorkspaceFolder, selectWorkspaceFolders } from '../../util/workspace';
import { validateName } from '../common/utils';
import { ChildProcess, SpawnOptions } from 'child_process';
import { ClusterVersion } from '../../serveressFunction/types';
import { Command } from '../../serveressFunction/commands';

interface OverridePanel extends vscode.WebviewPanel {
    contextPath?: vscode.Uri;
}

export interface ServiceBindingFormResponse {
    selectedService: string;
    bindingName: string;
}

async function gitImportMessageListener(panel: OverridePanel, event: any): Promise<any> {
    let response: CliExitData | undefined = undefined;
    const eventName = event.action;
    const functionName = event.name;
    const functionPath: vscode.Uri = event.folderPath ? vscode.Uri.from(event.folderPath) : undefined;
    switch (eventName) {
        case 'validateName':
            const flag = validateName(functionName);
            panel?.webview.postMessage({
                action: eventName,
                error: !flag ? false : true,
                helpText: !flag ? '' : flag,
                name: functionName
            });
            break;
        case 'selectFolder':
            const workspaceFolderItems = event.noWSFolder ? await selectWorkspaceFolder(true, 'Select Function Folder') : selectWorkspaceFolders();
            panel?.webview.postMessage({
                action: eventName,
                wsFolderItems: event.noWSFolder ? [workspaceFolderItems] : workspaceFolderItems
            });
            break;
        case 'createFunction':
            const selctedFolder: vscode.Uri = vscode.Uri.file(path.join(functionPath.fsPath, functionName));
            panel.title = `Serverless Function - Create - ${functionName}`;
            await panel.webview.postMessage({
                action: 'loadScreen',
                show: true
            });
            await Progress.execFunctionWithProgress(
                `Creating function '${functionName}'`,
                async () => {
                    response = await serverlessInstance().createFunction(event.language, event.template, selctedFolder.fsPath);
                });
            if (response && response.error) {
                await panel.webview.postMessage({
                    action: 'loadScreen',
                    show: false
                })
                vscode.window.showErrorMessage(`Error while creating the function ${functionName}`);
                panel.webview.postMessage({
                    action: eventName,
                    name: functionName,
                    path: selctedFolder,
                    success: false
                })
            } else {
                panel.contextPath = selctedFolder;
                ServerlessFunctionViewLoader.views.delete('//new')
                ServerlessFunctionViewLoader.views.set(selctedFolder.fsPath, panel);
                await panel.webview.postMessage({
                    action: 'loadScreen',
                    show: false
                })
                panel.webview.postMessage({
                    action: eventName,
                    name: functionName,
                    path: selctedFolder,
                    success: true
                });
                await vscode.commands.executeCommand('openshift.Serverless.refresh');
            }
            break;
        case 'getImage':
            panel.title = `Serverless Function - Build - ${functionName}`;
            const images = await BuildAndDeploy.getInstance().getImages(functionName, functionPath);
            panel.webview.postMessage({
                action: eventName,
                path: functionPath,
                images: images
            });
            break;
        case 'buildFunction':
            await panel.webview.postMessage({
                action: 'loadScreen',
                show: true
            });
            const outputEmitter = new vscode.EventEmitter<string>();
            let devProcess: ChildProcess;
            let processError = false;
            const clusterVersion: ClusterVersion | null = await BuildAndDeploy.getInstance().checkOpenShiftCluster();
            try {
                let terminal = vscode.window.createTerminal({
                    name: `Build ${functionName}`,
                    pty: {
                        onDidWrite: outputEmitter.event,
                        open: () => {
                            outputEmitter.fire(`Start Building ${functionName} \r\n`);
                            const opt: SpawnOptions = { cwd: functionPath.fsPath };
                            void CliChannel.getInstance().spawnTool(Command.buildFunction(functionPath.fsPath, event.image, clusterVersion), opt).then((cp) => {
                                devProcess = cp;
                                devProcess.on('spawn', () => {
                                    terminal.show();
                                });
                                devProcess.on('error', async (err) => {
                                    processError = true;
                                    void vscode.window.showErrorMessage(err.message);
                                });
                                devProcess.stdout.on('data', (chunk) => {
                                    outputEmitter.fire(`${chunk as string}`.replaceAll('\n', '\r\n'));
                                });
                                devProcess.stderr.on('data', async (errChunk) => {
                                    processError = true;
                                    outputEmitter.fire(`\x1b[31m${errChunk as string}\x1b[0m`.replaceAll('\n', '\r\n'));
                                });
                                devProcess.on('exit', async () => {
                                    await panel.webview.postMessage({
                                        action: 'loadScreen',
                                        show: false
                                    });
                                    await panel.webview.postMessage({
                                        action: eventName,
                                        success: processError ? false : true
                                    });
                                    outputEmitter.fire('\r\nPress any key to close this terminal\r\n');
                                });
                            });
                        },
                        close: () => {
                            if (devProcess && devProcess.exitCode === null) { // if process is still running and user closed terminal
                                devProcess.kill('SIGINT');
                            }
                            terminal = undefined;
                        },
                        handleInput: ((data: string) => {
                            if (!devProcess) {
                                terminal.dispose();
                            } else {
                                outputEmitter.fire('^C\r\n');
                                devProcess.kill('SIGINT');
                                terminal.dispose()
                            }
                        })
                    },
                });
            } catch (err) {
                void vscode.window.showErrorMessage(err.message);
            }
            break;
        case 'runFunction':
            try {
                const outputEmitter = new vscode.EventEmitter<string>();
                let runProcess: ChildProcess;
                let showStop = true;
                let terminal = vscode.window.createTerminal({
                    name: `Run ${functionName}`,
                    pty: {
                        onDidWrite: outputEmitter.event,
                        open: () => {
                            outputEmitter.fire(`Running ${functionName} \r\n`);
                            const opt: SpawnOptions = { cwd: functionPath.fsPath };
                            void CliChannel.getInstance().spawnTool(Command.runFunction(functionPath.fsPath, event.runBuild), opt).then((cp) => {
                                runProcess = cp;
                                runProcess.on('spawn', async () => {
                                    terminal.show();
                                    ServerlessFunctionViewLoader.processMap.set(`run-${functionPath.fsPath}`, runProcess);
                                    await panel.webview.postMessage({
                                        action: eventName,
                                        success: showStop
                                    });
                                });
                                runProcess.on('error', async (err) => {
                                    showStop = false;
                                    void vscode.window.showErrorMessage(err.message);
                                });
                                runProcess.stdout.on('data', (chunk) => {
                                    outputEmitter.fire(`${chunk as string}`.replaceAll('\n', '\r\n'));
                                });
                                runProcess.stderr.on('data', async (errChunk) => {
                                    showStop = false;
                                    outputEmitter.fire(`\x1b[31m${errChunk as string}\x1b[0m`.replaceAll('\n', '\r\n'));
                                });
                                runProcess.on('exit', async () => {
                                    await panel.webview.postMessage({
                                        action: eventName,
                                        success: showStop
                                    });
                                    outputEmitter.fire('\r\nPress any key to close this terminal\r\n');
                                });
                            });
                        },
                        close: () => {
                            if (runProcess && runProcess.exitCode === null) { // if process is still running and user closed terminal
                                runProcess.kill('SIGINT');
                                ServerlessFunctionViewLoader.processMap.delete(`run-${functionPath.fsPath}`);
                            }
                            terminal = undefined;
                        },
                        handleInput: ((data: string) => {
                            if (!devProcess) {
                                terminal.dispose();
                            } else {
                                outputEmitter.fire('^C\r\n');
                                runProcess.kill('SIGINT');
                                ServerlessFunctionViewLoader.processMap.delete(`run-${functionPath.fsPath}`);
                                terminal.dispose()
                            }
                        })
                    },
                });
            } catch (err) {
                void vscode.window.showErrorMessage(err.message);
            }
            break;
        case 'stopRunFunction':
            try {
                const child_process = ServerlessFunctionViewLoader.processMap.get(`run-${functionPath.fsPath}`);
                if (child_process) {
                    child_process.kill('SIGTERM');
                    ServerlessFunctionViewLoader.processMap.delete(`run-${functionPath.fsPath}`);
                }
                panel.webview.postMessage({
                    action: eventName,
                    success: true
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Error occured while stop the function ${functionName}`)
                panel.webview.postMessage({
                    action: eventName,
                    success: false
                });
            }
        case 'finish':
            const result = await vscode.window.showInformationMessage('Are you sure want to skip all other steps?', 'Yes', 'Cancel');
            if (result === 'Yes') {
                const addedWSPath = vscode.Uri.from(functionPath);
                const wsFolder = vscode.workspace.getWorkspaceFolder(addedWSPath);
                if (!wsFolder) {
                    vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, null, { uri: addedWSPath });
                }
                panel.dispose();
            }
            break;
        default:
            break;
    }
}

function processStep(panel: vscode.WebviewPanel, folderPath: vscode.Uri, name: string, stepCount: number) {
    switch (stepCount) {
        case 1:
            panel.webview.postMessage({
                action: 'createFunction',
                name: name,
                path: folderPath,
                success: true
            });
            break;
        default:
            break;
    }
}

export default class ServerlessFunctionViewLoader {

    public static views: Map<string, OverridePanel> = new Map();

    public static processMap: Map<string, ChildProcess> = new Map();

    private static get extensionPath(): string {
        return vscode.extensions.getExtension(ExtensionID).extensionPath;
    }

    /**
     * Returns a webview panel with the "Add Service Binding" UI,
     * or if there is an existing view for the given contextPath, focuses that view and returns null.
     *
     * @param contextPath the path to the component that's being binded to a service
     * @param availableServices the list of all bindable services on the cluster
     * @param listenerFactory the listener function to receive and process messages from the webview
     * @return the webview as a promise
     */
    static async loadView(
        title: string,
        contextPath?: vscode.Uri,
        name = '',
        stepCount = 0
    ): Promise<OverridePanel | null> {

        const pathString = contextPath ? contextPath.fsPath : 'new'

        if (ServerlessFunctionViewLoader.views.get(pathString)) {
            // the event handling for the panel should already be set up,
            // no need to handle it
            const panel = ServerlessFunctionViewLoader.views.get(pathString);
            panel.reveal(vscode.ViewColumn.One);
            return null;
        }

        return this.createView(title, contextPath, name, stepCount);
    }

    private static async createView(
        title: string,
        contextPath: vscode.Uri,
        name: string,
        stepCount: number,
    ): Promise<OverridePanel> {

        contextPath = contextPath ? contextPath : vscode.Uri.parse('new');

        const localResourceRoot = vscode.Uri.file(
            path.join(ServerlessFunctionViewLoader.extensionPath, 'out', 'serverlessFunctionViewer'),
        );

        let panel: OverridePanel = vscode.window.createWebviewPanel(
            'serverlessFunctionView',
            title,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true,
            },
        );

        panel.contextPath = contextPath;

        panel.iconPath = vscode.Uri.file(
            path.join(ServerlessFunctionViewLoader.extensionPath, 'images/context/cluster-node.png'),
        );
        panel.webview.html = await loadWebviewHtml(
            'serverlessFunctionViewer',
            panel,
        );
        panel.webview.onDidReceiveMessage((e) => gitImportMessageListener(panel, e));

        panel.onDidDispose(() => {
            ServerlessFunctionViewLoader.views.delete(contextPath.fsPath);
            const folderPath: vscode.Uri = panel.contextPath;
            const addedWSPath = typeof folderPath === 'string' ? vscode.Uri.parse(folderPath) : vscode.Uri.from(folderPath);
            const wsFolder = vscode.workspace.getWorkspaceFolder(addedWSPath);
            if (!wsFolder) {
                vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, null, { uri: addedWSPath });
            }
            panel = undefined;
        });
        ServerlessFunctionViewLoader.views.set(contextPath.fsPath, panel);
        processStep(panel, contextPath, name, stepCount);
        return Promise.resolve(panel);
    }
}

