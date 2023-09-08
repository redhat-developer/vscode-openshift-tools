/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ChildProcess, SpawnOptions } from 'child_process';
import validator from 'validator';
import { commands, EventEmitter, Terminal, Uri, window } from 'vscode';
import { CliChannel } from '../cli';
import { OdoImpl } from '../odo';
import { CliExitData } from '../util/childProcessUtil';
import { Platform } from '../util/platform';
import { Progress } from '../util/progress';
import { ServerlessCommand, Utils } from './commands';
import { multiStep } from './multiStepInput';
import { ClusterVersion, FunctionContent, FunctionObject, FunctionView, InvokeFunction, RunResponse } from './types';

export class Functions {

    private static instance: Functions;

    protected static readonly cli = CliChannel.getInstance();

    private buildTerminalMap: Map<string, Terminal> = new Map<string, Terminal>();
    public runTerminalMap: Map<string, Terminal> = new Map<string, Terminal>();
    private buildEmiterMap: Map<string, EventEmitter<string>> = new Map<string, EventEmitter<string>>();
    private buildPrcessMap: Map<Terminal, ChildProcess> = new Map<Terminal, ChildProcess>();

    public static imageRegex = RegExp('[^/]+\\.[^/.]+\\/([^/.]+)(?:\\/[\\w\\s._-]*([\\w\\s._-]))*(?::[a-z0-9\\.-]+)?$');

    static getInstance(): Functions {
        if (!Functions.instance) {
            Functions.instance = new Functions();
        }
        return Functions.instance;
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

    public async build(context: FunctionObject, view: FunctionView): Promise<void> {
        const exisitingTerminal = this.buildTerminalMap.get(`build-${context.folderURI.fsPath}`);
        const outputEmitter = this.buildEmiterMap.get(`build-${context.folderURI.fsPath}`);
        if (exisitingTerminal) {
            let exisitingProcess = this.buildPrcessMap.get(exisitingTerminal);
            void window.showWarningMessage(`Do you want to restart ${context.name} build ?`, 'Yes', 'No').then(async (value: string) => {
                if (value === 'Yes') {
                    exisitingTerminal.show(true);
                    await commands.executeCommand('workbench.action.terminal.clear')
                    outputEmitter.fire(`Start Building ${context.name} \r\n`);
                    exisitingProcess.kill('SIGINT')
                    this.buildPrcessMap.delete(exisitingTerminal);
                    const clusterVersion: ClusterVersion | null = await this.checkOpenShiftCluster();
                    const buildImage = await this.getImage(context.folderURI);
                    const opt: SpawnOptions = { cwd: context.folderURI.fsPath };
                    void CliChannel.getInstance().spawnTool(ServerlessCommand.buildFunction(context.folderURI.fsPath, buildImage, clusterVersion), opt).then((cp) => {
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
                            context.hadBuilt = true;
                            view.refresh(context);
                            outputEmitter.fire('\r\nPress any key to close this terminal\r\n');
                        });
                    });
                }
            });
        } else {
            await this.buildProcess(context, view);
        }
    }

    private async buildProcess(context: FunctionObject, view: FunctionView) {
        const clusterVersion: ClusterVersion | null = await this.checkOpenShiftCluster();
        const buildImage = await this.getImage(context.folderURI);
        const outputEmitter = new EventEmitter<string>();
        let devProcess: ChildProcess;
        let terminal = window.createTerminal({
            name: `Build ${context.name}`,
            pty: {
                onDidWrite: outputEmitter.event,
                open: () => {
                    outputEmitter.fire(`Start Building ${context.name} \r\n`);
                    const opt: SpawnOptions = { cwd: context.folderURI.fsPath };
                    void CliChannel.getInstance().spawnTool(ServerlessCommand.buildFunction(context.folderURI.fsPath, buildImage, clusterVersion), opt).then((cp) => {
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
                            context.hadBuilt = true;
                            view.refresh(context);
                            outputEmitter.fire('\r\nPress any key to close this terminal\r\n');
                        });
                    });
                },
                close: () => {
                    if (devProcess && devProcess.exitCode === null) { // if process is still running and user closed terminal
                        devProcess.kill('SIGINT');
                    }
                    this.buildTerminalMap.delete(`build-${context.folderURI.fsPath}`);
                    this.buildEmiterMap.delete(`build-${context.folderURI.fsPath}`);
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
        this.buildTerminalMap.set(`build-${context.folderURI.fsPath}`, terminal);
        this.buildEmiterMap.set(`build-${context.folderURI.fsPath}`, outputEmitter);
    }

    public run(context: FunctionObject, runBuild = false) {
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
                            try {
                                const json = JSON.parse(`${chunk as string}`) as RunResponse;
                                if (json.msg?.indexOf('Server listening at') !== -1) {
                                    outputEmitter.fire(`\n\n Press ctrl+C for stop running ${context.name}`);
                                }
                            } catch (err) {
                                // no action
                            }
                            void commands.executeCommand('openshift.Serverless.refresh');
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
                    void commands.executeCommand('openshift.Serverless.refresh');
                },
                handleInput: ((data: string) => {
                    if (data.charCodeAt(0) === 3 || data.charCodeAt(0) === 94) {
                        if (!runProcess) {
                            terminal.dispose();
                        } else {
                            outputEmitter.fire('^C\r\n');
                            runProcess.kill('SIGINT');
                            terminal.dispose()
                        }
                    }
                })
            },
        });
        this.runTerminalMap.set(`run-${context.folderURI.fsPath}`, terminal);
    }

    public stop(context: FunctionObject) {
        const terminal = this.runTerminalMap.get(`run-${context.folderURI.fsPath}`);
        if (terminal) {
            terminal.sendText('^C\r\n');
        }
    }

    public undeploy(context: FunctionObject) {
        void Progress.execFunctionWithProgress(`Undeploying the function ${context.name}`, async () => {
            const result = await OdoImpl.Instance.execute(ServerlessCommand.undeployFunction(context.name));
            if (result.error) {
                void window.showErrorMessage(result.error.message);
            } else {
                void commands.executeCommand('openshift.Serverless.refresh');
            }
        });
    }

    public async getTemplates(): Promise<CliExitData> {
        const result = await OdoImpl.Instance.execute(ServerlessCommand.getTemplates(), undefined, false);
        if (result.error) {
            void window.showErrorMessage(result.error.message);
        }
        return JSON.parse(result.stdout);
    }

    public async deploy(context: FunctionObject) {
        const currentNamespace: string = await OdoImpl.Instance.getActiveProject();
        const yamlContent = await Utils.getFuncYamlContent(context.folderURI.fsPath);
        if (yamlContent) {
            const deployedNamespace = yamlContent.deploy?.namespace || undefined;
            if (!deployedNamespace) {
                await this.deployProcess(context, deployedNamespace, yamlContent);
            } else if (deployedNamespace !== currentNamespace) {
                const response = await window.showInformationMessage(`Function namespace (declared in func.yaml) is different from the current active namespace. Deploy function ${context.name} to current namespace ${currentNamespace}?`,
                    'Ok',
                    'Cancel');
                if (response === 'Ok') {
                    await this.deployProcess(context, currentNamespace, yamlContent);
                }
            } else {
                await this.deployProcess(context, deployedNamespace, yamlContent);
            }
        }
    }

    private async deployProcess(context: FunctionObject, deployedNamespace: string, yamlContent: FunctionContent) {
        if (!yamlContent.image || !Functions.imageRegex.test(yamlContent.image)) {
            void window.showErrorMessage(`Function ${context.name} has invalid imaage`)
            return;
        }
        const clusterVersion: ClusterVersion | null = await this.checkOpenShiftCluster();
        const buildImage = await this.getImage(context.folderURI);
        const outputEmitter = new EventEmitter<string>();
        let deployProcess: ChildProcess;
        let terminal = window.createTerminal({
            name: `Deploying the function ${context.name}`,
            pty: {
                onDidWrite: outputEmitter.event,
                open: () => {
                    outputEmitter.fire(`Deploying ${context.name} \r\n`);
                    const opt: SpawnOptions = { cwd: context.folderURI.fsPath };
                    void CliChannel.getInstance().spawnTool(ServerlessCommand.deployFunction(context.folderURI.fsPath, buildImage, deployedNamespace, clusterVersion), opt).then((cp) => {
                        deployProcess = cp;
                        deployProcess.on('spawn', () => {
                            terminal.show();
                        });
                        deployProcess.on('error', (err) => {
                            void window.showErrorMessage(err.message);
                        });
                        // eslint-disable-next-line @typescript-eslint/no-misused-promises
                        deployProcess.stdout.on('data', async (chunk) => {
                            const response = `${chunk as string}`.replaceAll('\n', '\r\n');
                            if (response.includes('Please provide credentials for image registry')) {
                                response.replace(/Please provide credentials for image registry/gm, '');
                                await this.provideUserNameAndPassword(deployProcess, 'Please provide credentials for image registry.');
                            }
                            if (response.includes('Incorrect credentials, please try again')) {
                                response.replace(/Incorrect credentials, please try again/gm, '');
                                await this.provideUserNameAndPassword(deployProcess, 'Please provide credentials for image registry.', true);
                            }
                            outputEmitter.fire(response);
                        });
                        deployProcess.stderr.on('data', (errChunk) => {
                            outputEmitter.fire(`\x1b[31m${errChunk as string}\x1b[0m`.replaceAll('\n', '\r\n'));
                        });

                        deployProcess.on('exit', () => {
                            void commands.executeCommand('openshift.Serverless.refresh');
                            outputEmitter.fire('\r\nPress any key to close this terminal\r\n');
                        });
                    });
                },
                close: () => {
                    if (deployProcess && deployProcess.exitCode === null) { // if process is still running and user closed terminal
                        deployProcess.kill('SIGINT');
                    }
                    terminal = undefined;
                    void commands.executeCommand('openshift.Serverless.refresh');
                },
                handleInput: ((_data: string) => {
                    if (!deployProcess) {
                        terminal.dispose();
                    } else {
                        outputEmitter.fire('^C\r\n');
                        deployProcess.kill('SIGINT');
                        terminal.dispose()
                    }
                })
            },
        });
    }

    public async invoke(functionName: string, invokeFunData: InvokeFunction): Promise<void> {
        return new Promise<void>((resolve, _reject) => {
            const outputEmitter = new EventEmitter<string>();
            let runProcess: ChildProcess;
            let terminal = window.createTerminal({
                name: `Invoke ${functionName}`,
                pty: {
                    onDidWrite: outputEmitter.event,
                    open: () => {
                        void CliChannel.getInstance().spawnTool(ServerlessCommand.invokeFunction(invokeFunData)).then((cp) => {
                            runProcess = cp;
                            runProcess.on('spawn', () => {
                                terminal.show();
                            });
                            runProcess.on('error', (err) => {
                                void window.showErrorMessage(err.message);
                            });
                            runProcess.stdout.on('data', (chunk) => {
                                outputEmitter.fire(`${chunk as string}`.replaceAll('\n', '\r\n'));
                            });
                            runProcess.stderr.on('data', (errChunk) => {
                                outputEmitter.fire(`\x1b[31m${errChunk as string}\x1b[0m`.replaceAll('\n', '\r\n'));
                            });
                            runProcess.on('exit', () => {
                                outputEmitter.fire('\r\nPress any key to close this terminal\r\n');
                                resolve();
                            });
                        });
                    },
                    close: () => {
                        if (runProcess && runProcess.exitCode === null) { // if process is still running and user closed terminal
                            runProcess.kill('SIGINT');
                        }
                        terminal = undefined;
                    },
                    handleInput: ((data: string) => {
                        if (data.charCodeAt(0) > 0) {
                            if (!runProcess) {
                                terminal.dispose();
                            } else {
                                outputEmitter.fire('^C\r\n');
                                runProcess.kill('SIGINT');
                                terminal.dispose()
                            }
                        }
                    })
                },
            });
        });
    }

    public async config(title: string, context: FunctionObject, mode: string, isAdd = true) {
        await Functions.cli.executeInTerminal(ServerlessCommand.config(context.folderURI.fsPath, mode, isAdd),
            context.folderURI.fsPath, title, process.env, true);
    }

    private async provideUserNameAndPassword(
        process: ChildProcess,
        message: string,
        reattemptForLogin?: boolean,
    ): Promise<void> {
        const userInfo = 'Provide username for image registry.';
        const userName = await this.getUsernameOrPassword(
            message,
            userInfo,
            false,
            'Provide an username for image registry.',
            reattemptForLogin,
        );
        if (!userName) {
            process.stdin.end();
            return null;
        }
        const passMessage = 'Provide password for image registry.';
        const userPassword = await this.getUsernameOrPassword(message, passMessage, true, 'Provide a password for image registry.');
        if (!userPassword) {
            process.stdin.end();
            return null;
        }
        process.stdin.write(`${userName}\n${userPassword}\n`);
    }

    private async getUsernameOrPassword(
        message: string,
        infoMessage: string,
        passwordType?: boolean,
        errorMessage?: string,
        reattemptForLogin?: boolean,
    ): Promise<string | null> {
        return multiStep.showInputBox({
            title: message,
            prompt: infoMessage,
            placeholder: infoMessage,
            reattemptForLogin,
            validate: (value: string) => {
                if (validator.isEmpty(value)) {
                    return errorMessage;
                }
                return null;
            },
            password: passwordType,
        });
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
        if (yamlContent?.image && Functions.imageRegex.test(yamlContent.image)) {
            return yamlContent.image
        }
        return null;
    }
}
