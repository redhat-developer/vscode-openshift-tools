/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { EventEmitter, Terminal, Uri, commands, window } from 'vscode';
import { ClusterVersion, FunctionObject } from './types';
import { ServerlessCommand, Utils } from './commands';
import { Platform } from '../util/platform';
import { OdoImpl } from '../odo';
import { CliChannel } from '../cli';
import { ChildProcess, SpawnOptions } from 'child_process';

export class BuildAndDeploy {

    private static instance: BuildAndDeploy;

    private buildTerminalMap: Map<string, Terminal> = new Map<string, Terminal>();
    public  runTerminalMap: Map<string, Terminal> = new Map<string, Terminal>();
    private buildEmiterMap: Map<string, EventEmitter<string>> = new Map<string, EventEmitter<string>>();
    private buildPrcessMap: Map<Terminal, ChildProcess> = new Map<Terminal, ChildProcess>();

    public static imageRegex = RegExp('[^/]+\\.[^/.]+\\/([^/.]+)(?:\\/[\\w\\s._-]*([\\w\\s._-]))*(?::[a-z0-9\\.-]+)?$');

    static getInstance(): BuildAndDeploy {
        if (!BuildAndDeploy.instance) {
            BuildAndDeploy.instance = new BuildAndDeploy();
        }
        return BuildAndDeploy.instance;
    }

    checkRunning(fsPath: string): boolean {
        return this.runTerminalMap.has(`run-${fsPath}`);
    }

    public async checkOpenShiftCluster(): Promise<ClusterVersion> {
        try {
            const result = await OdoImpl.Instance.execute(ServerlessCommand.getClusterVersion());
            if (result?.stdout?.trim()) {
                return JSON.parse(result?.stdout) as ClusterVersion;
            }
            return null;
        } catch (err) {
            return null;
        }
    }

    public async buildFunction(functionName: string, functionUri: Uri): Promise<void> {
        const exisitingTerminal = this.buildTerminalMap.get(`build-${functionUri.fsPath}`);
        const outputEmitter = this.buildEmiterMap.get(`build-${functionUri.fsPath}`);
        if (exisitingTerminal) {
            let exisitingProcess = this.buildPrcessMap.get(exisitingTerminal);
            void window.showWarningMessage(`Do you want to restart ${functionName} build ?`, 'Yes', 'No').then(async (value: string) => {
                if (value === 'Yes') {
                    exisitingTerminal.show(true);
                    await commands.executeCommand('workbench.action.terminal.clear')
                    outputEmitter.fire(`Start Building ${functionName} \r\n`);
                    exisitingProcess.kill('SIGINT')
                    this.buildPrcessMap.delete(exisitingTerminal);
                    const clusterVersion: ClusterVersion | null = await this.checkOpenShiftCluster();
                    const buildImage = await this.getImage(functionUri);
                    const opt: SpawnOptions = { cwd: functionUri.fsPath };
                    void CliChannel.getInstance().spawnTool(ServerlessCommand.buildFunction(functionUri.fsPath, buildImage, clusterVersion), opt).then((cp) => {
                        exisitingProcess = cp;
                        this.buildPrcessMap.set(exisitingTerminal, cp);
                        exisitingProcess.on('error', (err) => {
                            void window.showErrorMessage(err.message);
                        });
                        exisitingProcess.stdout.on('data', (chunk) => {
                            outputEmitter.fire(`${chunk as string}`.replaceAll('\n', '\r\n'));
                        });
                        exisitingProcess.stderr.on('data', (errChunk) => {
                            outputEmitter.fire(`\x1b[31m${errChunk as string}\x1b[0m`.replaceAll('\n', '\r\n'));
                            void window.showErrorMessage(`${errChunk as string}`);
                        });
                        exisitingProcess.on('exit', () => {
                            outputEmitter.fire('\r\nPress any key to close this terminal\r\n');
                        });
                    });
                }
            });
        } else {
            await this.buildProcess(functionUri, functionName);
        }
    }

    private async buildProcess(functionUri: Uri, functionName: string) {
        const clusterVersion: ClusterVersion | null = await this.checkOpenShiftCluster();
        const buildImage = await this.getImage(functionUri);
        const outputEmitter = new EventEmitter<string>();
        let devProcess: ChildProcess;
        let terminal = window.createTerminal({
            name: `Build ${functionName}`,
            pty: {
                onDidWrite: outputEmitter.event,
                open: () => {
                    outputEmitter.fire(`Start Building ${functionName} \r\n`);
                    const opt: SpawnOptions = { cwd: functionUri.fsPath };
                    void CliChannel.getInstance().spawnTool(ServerlessCommand.buildFunction(functionUri.fsPath, buildImage, clusterVersion), opt).then((cp) => {
                        this.buildPrcessMap.set(terminal, cp);
                        devProcess = cp;
                        devProcess.on('spawn', () => {
                            terminal.show();
                        });
                        devProcess.on('error', (err) => {
                            void window.showErrorMessage(err.message);
                        });
                        devProcess.stdout.on('data', (chunk) => {
                            outputEmitter.fire(`${chunk as string}`.replaceAll('\n', '\r\n'));
                        });
                        devProcess.stderr.on('data', (errChunk) => {
                            outputEmitter.fire(`\x1b[31m${errChunk as string}\x1b[0m`.replaceAll('\n', '\r\n'));
                        });
                        devProcess.on('exit', () => {
                            outputEmitter.fire('\r\nPress any key to close this terminal\r\n');
                        });
                    });
                },
                close: () => {
                    if (devProcess && devProcess.exitCode === null) { // if process is still running and user closed terminal
                        devProcess.kill('SIGINT');
                    }
                    this.buildTerminalMap.delete(`build-${functionUri.fsPath}`);
                    this.buildEmiterMap.delete(`build-${functionUri.fsPath}`);
                    this.buildPrcessMap.delete(terminal);
                    terminal = undefined;
                },
                handleInput: ((data: string) => {
                    if (!devProcess) { // if any key pressed after process ends
                        terminal.dispose();
                    } else { // ctrl+C processed only once when there is no cleaning process
                        outputEmitter.fire('^C\r\n');
                        devProcess.kill('SIGINT');
                        terminal.dispose();
                    }
                })
            },
        });
        this.buildTerminalMap.set(`build-${functionUri.fsPath}`, terminal);
        this.buildEmiterMap.set(`build-${functionUri.fsPath}`, outputEmitter);
    }

    public runFunction(context: FunctionObject, runBuild = false) {
        const outputEmitter = new EventEmitter<string>();
        let runProcess: ChildProcess;
        let terminal = window.createTerminal({
            name: `Run ${context.name}`,
            pty: {
                onDidWrite: outputEmitter.event,
                open: () => {
                    outputEmitter.fire(`Running ${context.name} \r\n`);
                    const opt: SpawnOptions = { cwd: context.folderURI.fsPath };
                    void CliChannel.getInstance().spawnTool(ServerlessCommand.runFunction(context.folderURI.fsPath, runBuild), opt).then((cp) => {
                        runProcess = cp;
                        runProcess.on('spawn', () => {
                            terminal.show();
                        });
                        runProcess.on('error', (err) => {
                            void window.showErrorMessage(err.message);
                        });
                        runProcess.stdout.on('data', (chunk) => {
                            outputEmitter.fire(`${chunk as string}`.replaceAll('\n', '\r\n'));
                            void commands.executeCommand('openshift.Serverless.refresh',context);
                        });
                        runProcess.stderr.on('data', (errChunk) => {
                            outputEmitter.fire(`\x1b[31m${errChunk as string}\x1b[0m`.replaceAll('\n', '\r\n'));
                        });
                        runProcess.on('exit', () => {
                            outputEmitter.fire('\r\nPress any key to close this terminal\r\n');
                        });
                    });
                },
                close: () => {
                    if (runProcess && runProcess.exitCode === null) { // if process is still running and user closed terminal
                        runProcess.kill('SIGINT');
                    }
                    this.runTerminalMap.delete(`run-${context.folderURI.fsPath}`);
                    terminal = undefined;
                    void commands.executeCommand('openshift.Serverless.refresh',context);
                },
                handleInput: ((_data: string) => {
                    if (!runProcess) {
                        terminal.dispose();
                    } else {
                        outputEmitter.fire('^C\r\n');
                        runProcess.kill('SIGINT');
                        terminal.dispose()
                    }
                })
            },
        });
        this.runTerminalMap.set(`run-${context.folderURI.fsPath}`, terminal);
    }

    public stopFunction(context: FunctionObject) {
        const terminal = this.runTerminalMap.get(`run-${context.folderURI.fsPath}`);
        if (terminal) {
            terminal.sendText('^C\r\n');
        }
    }

    public getDefaultImages(name: string): string[] {
        const imageList: string[] = [];
        const defaultUsername = Platform.getEnv();
        const defaultQuayImage = `quay.io/${Platform.getOS() === 'win32' ? defaultUsername.USERNAME : defaultUsername.USER}/${name}:latest`;
        const defaultDockerImage = `docker.io/${Platform.getOS() === 'win32' ? defaultUsername.USERNAME : defaultUsername.USER}/${name}:latest`;
        imageList.push(defaultQuayImage);
        imageList.push(defaultDockerImage);
        return imageList;
    }

    public async getImage(folderURI: Uri): Promise<string> {
        const yamlContent = await Utils.getFuncYamlContent(folderURI.fsPath);
        if (yamlContent?.image && BuildAndDeploy.imageRegex.test(yamlContent.image)) {
            return yamlContent.image
        }
        return null;
    }
}
