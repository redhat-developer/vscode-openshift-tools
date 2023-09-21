/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import validator from 'validator';
import { Uri, commands, window } from 'vscode';
import { CliChannel } from '../cli';
import { OdoImpl } from '../odo';
import { Platform } from '../util/platform';
import { Progress } from '../util/progress';
import { OpenShiftTerminalApi, OpenShiftTerminalManager } from '../webview/openshift-terminal/openShiftTerminal';
import { ServerlessCommand, Utils } from './commands';
import { multiStep } from './multiStepInput';
import { ClusterVersion, FunctionContent, FunctionObject, FunctionView, InvokeFunction } from './types';

export class Functions {

    private static instance: Functions;

    protected static readonly cli = CliChannel.getInstance();

    private buildTerminalMap = new Map<string, OpenShiftTerminalApi>();
    public runTerminalMap = new Map<string, OpenShiftTerminalApi>();

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

    private pollForBuildTerminalDead(resolve: () => void, functionUri: Uri, timeout: number) {
        return () => {
            if (!this.buildTerminalMap.get(`build-${functionUri.fsPath}`)) {
                resolve();
            } else {
                setTimeout(this.pollForBuildTerminalDead(resolve, functionUri, timeout * 2), timeout * 2);
            }
        }
    }

    public async build(context: FunctionObject, view: FunctionView): Promise<void> {
        const existingTerminal: OpenShiftTerminalApi = this.buildTerminalMap.get(`build-${context.folderURI.fsPath}`);

        if (existingTerminal) {
            void window.showWarningMessage(`Do you want to restart ${context.name} build ?`, 'Yes', 'No').then(async (value: string) => {
                if (value === 'Yes') {
                    existingTerminal.focusTerminal();
                    existingTerminal.kill();

                    // wait for old build to exit using polling with a back off
                    await new Promise<void>((resolve) => {
                        const INIT_TIMEOUT = 100;
                        setTimeout(this.pollForBuildTerminalDead(resolve, context.folderURI, INIT_TIMEOUT), INIT_TIMEOUT);
                    });

                    // start new build
                    await this.buildProcess(context, view);
                }
            });
        } else {
            await this.buildProcess(context, view);
        }
    }

    private async buildProcess(context: FunctionObject, view: FunctionView) {
        const clusterVersion: ClusterVersion | null = await this.checkOpenShiftCluster();
        const buildImage = await this.getImage(context.folderURI);
        const terminalKey = `build-${context.folderURI.fsPath}`;

        const terminal = await OpenShiftTerminalManager.getInstance().createTerminal(
            ServerlessCommand.buildFunction(context.folderURI.fsPath, buildImage, clusterVersion),
            `Build ${context.name}`,
            context.folderURI.fsPath,
            process.env,
            true,
            {
                onExit: () => {
                    this.buildTerminalMap.delete(terminalKey)
                }
            }
        );

        this.buildTerminalMap.set(terminalKey, terminal);
    }

    public async run(context: FunctionObject, runBuild = false) {
        const terminal = await OpenShiftTerminalManager.getInstance().createTerminal(
            ServerlessCommand.runFunction(context.folderURI.fsPath, runBuild),
            `${runBuild ? 'Build and ' : ''}Run ${context.name}`,
            context.folderURI.fsPath,
            process.env,
            false,
            {
                onSpawn: () => {
                    void commands.executeCommand('openshift.Serverless.refresh', context);
                },
                onExit: () => {
                    this.runTerminalMap.delete(`run-${context.folderURI.fsPath}`);
                    void commands.executeCommand('openshift.Serverless.refresh', context);
                }
            }
        );
        this.runTerminalMap.set(`run-${context.folderURI.fsPath}`, terminal);
    }

    public stop(context: FunctionObject) {
        const terminal = this.runTerminalMap.get(`run-${context.folderURI.fsPath}`);
        if (terminal) {
            terminal.kill();
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

    public async getTemplates(): Promise<any[]> {
        const result = await OdoImpl.Instance.execute(ServerlessCommand.getTemplates(), undefined, false);
        if (result.error) {
            void window.showErrorMessage(result.error.message);
        }
        return JSON.parse(result.stdout) as any[];
    }

    public async deploy(context: FunctionObject) {
        const currentNamespace: string = await OdoImpl.Instance.getActiveProject();
        const yamlContent = await Utils.getFuncYamlContent(context.folderURI.fsPath);
        if (yamlContent) {
            const deployedNamespace = yamlContent.deploy?.namespace || undefined;
            if (!deployedNamespace || (deployedNamespace === currentNamespace)) {
                await this.deployProcess(context, deployedNamespace, yamlContent);
            } else if (deployedNamespace !== currentNamespace) {
                const response = await window.showInformationMessage(`Function namespace (declared in func.yaml) is different from the current active namespace. Deploy function ${context.name} to current namespace ${currentNamespace}?`,
                    'Ok',
                    'Cancel');
                if (response === 'Ok') {
                    await this.deployProcess(context, currentNamespace, yamlContent);
                }
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

        // fail after two failed login attempts
        let triedLoginTwice = false;

        const terminal = await OpenShiftTerminalManager.getInstance().createTerminal(
            ServerlessCommand.deployFunction(context.folderURI.fsPath, buildImage, deployedNamespace, clusterVersion),
            `Deploy ${context.name}`,
            context.folderURI.fsPath,
            undefined,
            false,
            {
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                onText: (text) => {
                    if (text.includes('Please provide credentials for image registry')) {
                        void this.provideUserNameAndPassword(terminal, 'Please provide credentials for image registry.');
                    }
                    if (text.includes('Incorrect credentials, please try again')) {
                        if (triedLoginTwice) {
                            terminal.kill();
                        } else {
                            triedLoginTwice = true;
                            void this.provideUserNameAndPassword(terminal, 'Please provide credentials for image registry.', true);
                        }
                    }
                },
                onExit() {
                    void commands.executeCommand('openshift.Serverless.refresh');
                },
            }
        );
    }

    public async invoke(functionName: string, invokeFunData: InvokeFunction): Promise<void> {
        await OpenShiftTerminalManager.getInstance().createTerminal(
            ServerlessCommand.invokeFunction(invokeFunData),
            `Invoke ${functionName}`,
            undefined,
            undefined,
            false
            );
    }

    public async config(title: string, context: FunctionObject, mode: string, isAdd = true) {
        await OpenShiftTerminalManager.getInstance().executeInTerminal(ServerlessCommand.config(context.folderURI.fsPath, mode, isAdd),
            context.folderURI.fsPath, title);
    }

    private async provideUserNameAndPassword(
        openshiftTerminalApi: OpenShiftTerminalApi,
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
            openshiftTerminalApi.kill();
            return null;
        }
        const passMessage = 'Provide password for image registry.';
        const userPassword = await this.getUsernameOrPassword(message, passMessage, true, 'Provide a password for image registry.');
        if (!userPassword) {
            openshiftTerminalApi.kill();
            return null;
        }
        openshiftTerminalApi.sendText(`${userName}\n`);
        await new Promise(resolve => {setTimeout(resolve, 100)});
        openshiftTerminalApi.sendText(`${userPassword}\n`);
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
