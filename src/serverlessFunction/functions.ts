/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import Dockerode from 'dockerode';
import validator from 'validator';
import { Uri, commands, window } from 'vscode';
import { CliChannel, ExecutionContext } from '../cli';
import { Oc } from '../oc/ocWrapper';
import { Odo } from '../odo/odoWrapper';
import { isTektonAware } from '../tekton/tekton';
import { ChildProcessUtil, CliExitData } from '../util/childProcessUtil';
import { getNamespaceKind, isOpenShiftCluster } from '../util/kubeUtils';
import { Progress } from '../util/progress';
import { OpenShiftTerminalApi, OpenShiftTerminalManager } from '../webview/openshift-terminal/openShiftTerminal';
import { ServerlessCommand, Utils } from './commands';
import { GitModel, getGitBranchInteractively, getGitRepoInteractively, getGitStateByPath } from './git/git';
import { isKnativeServingAware } from './knative';
import { multiStep } from './multiStepInput';
import { FunctionContent, FunctionObject, FunctionSession } from './types';

interface DockerStatus {
    error: boolean;
    message: string;
}

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

    private pollForBuildTerminalDead(resolve: () => void, functionUri: Uri, timeout: number) {
        return () => {
            if (!this.buildTerminalMap.get(`build-${functionUri.fsPath}`)) {
                resolve();
            } else {
                setTimeout(this.pollForBuildTerminalDead(resolve, functionUri, timeout * 2), timeout * 2);
            }
        }
    }

    private async getGitModel(fsPath?: string): Promise<GitModel> {
        const gitState = await getGitStateByPath(fsPath);

        const gitRemote = await getGitRepoInteractively(gitState);
        if (!gitRemote) {
            return null;
        }

        const gitBranch = await getGitBranchInteractively(gitState, gitRemote);
        if (!gitBranch) {
            return null;
        }
        return {
            remoteUrl: gitState.remotes.filter((r) => r.name === gitRemote).map((r) => r.fetchUrl)[0],
            branchName: gitBranch,
        };
    }

    public async onClusterBuild(context: FunctionObject): Promise<void> {
        const executionContext: ExecutionContext = new ExecutionContext();

        if (!await isTektonAware(executionContext)) {
            await window.showWarningMessage(
                'This action requires Tekton to be installed on the cluster. Please install it and then proceed to build the function on the cluster.',
            );
            return null;
        }

        if (!await isKnativeServingAware(executionContext)) {
            await window.showWarningMessage(
                'This action requires Knative Serving to be installed on the cluster. Please install it and then proceed to build the function on the cluster.',
            );
            return null;
        }

        const gitModel = await this.getGitModel(context.folderURI?.fsPath);
        if (!gitModel) {
            return null;
        }

        const buildImage = await this.getImage(context.folderURI);
        if (!buildImage) {
            return null;
        }

        const currentNamespace: string = await Oc.Instance.getActiveProject(executionContext);
        const yamlContent = await Utils.getFuncYamlContent(context.folderURI.fsPath);
        if (!yamlContent) {
            return null;
        }

        const deployedNamespace = yamlContent.deploy?.namespace || undefined;
        const kind = await getNamespaceKind(executionContext);
        if (deployedNamespace && deployedNamespace !== currentNamespace) {
            const response = await window.showInformationMessage(`Function ${kind} (declared in func.yaml) is different from the current active ${kind}. Deploy function ${context.name} to current ${kind} ${currentNamespace}?`,
                'Ok',
                'Cancel');
            if (response !== 'Ok') {
                return null;
            }
        }
        await this.clustrBuildTerminal(context, currentNamespace, buildImage, gitModel, executionContext);
    }

    private async clustrBuildTerminal(context: FunctionObject, namespace: string, buildImage: string, gitModel: GitModel, executionContext: ExecutionContext) {
        const isOpenShift = await isOpenShiftCluster(executionContext);
        const terminal = await OpenShiftTerminalManager.getInstance().createTerminal(
            ServerlessCommand.onClusterBuildFunction(context.folderURI.fsPath, namespace, buildImage, gitModel, isOpenShift),
            `On Cluster Build: ${context.name}`,
            context.folderURI.fsPath,
            process.env, {
            onExit: undefined,
        }, true
        );
        const session = {
            sessionName: `On Cluster Build: ${context.name}`,
            sessionPath: context.folderURI,
            teminal: terminal
        };
        this.addSession(context, session);
        void commands.executeCommand('openshift.Serverless.refresh', context);
    }

    private addSession(context: FunctionObject, session: FunctionSession) {
        if (context.sessions?.length > 0) {
            const withoutExistingSameSession = context.sessions.filter((exSession) => exSession.sessionName !== session.sessionName);
            context.sessions = withoutExistingSameSession;
            context.sessions.push(session);
        } else {
            context.sessions = [];
            context.sessions.push(session);
        }
    }

    private async checkDocker(): Promise<boolean> {
        let dockerStatus: DockerStatus = await this.isDockerRunning();
        if (dockerStatus.error) {
            dockerStatus = await this.isDockerOnPodman();
            if (dockerStatus.error) {
                void window.showErrorMessage(dockerStatus.message)
                return false;
            }
        }
        return true;
    }

    public async build(context: FunctionObject, s2iBuild: boolean): Promise<void> {
        if (! await this.checkDocker()) {
            return;
        }
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
                    await this.buildProcess(context, s2iBuild);
                }
            });
        } else {
            await this.buildProcess(context, s2iBuild);
        }
    }

    private async buildProcess(context: FunctionObject, s2iBuild: boolean) {
        const isOpenShift = await isOpenShiftCluster();
        const buildImage = await this.getImage(context.folderURI);
        const terminalKey = `build-${context.folderURI.fsPath}`;
        await this.buildTerminal(context, s2iBuild ? 's2i' : 'pack', buildImage, isOpenShift, terminalKey);
    }

    private async buildTerminal(context: FunctionObject, builder: string, buildImage: string, isOpenShiftCluster: boolean, terminalKey: string) {
        const terminal = await OpenShiftTerminalManager.getInstance().createTerminal(
            ServerlessCommand.buildFunction(context.folderURI.fsPath, builder, buildImage, isOpenShiftCluster),
            `Build: ${context.name}`,
            context.folderURI.fsPath,
            process.env,
            {
                onExit: () => {
                    this.buildTerminalMap.delete(terminalKey);
                },

            }, true
        );
        const session: FunctionSession = {
            sessionName: `Build: ${context.name}`,
            sessionPath: context.folderURI,
            teminal: terminal
        }
        this.addSession(context, session);
        void commands.executeCommand('openshift.Serverless.refresh', context);
        this.buildTerminalMap.set(terminalKey, terminal);
    }

    public async run(context: FunctionObject, runBuild = false) {
        if (! await this.checkDocker()) {
            return;
        }
        const terminal = await OpenShiftTerminalManager.getInstance().createTerminal(
            ServerlessCommand.runFunction(context.folderURI.fsPath, runBuild),
            `${runBuild ? 'Build and ' : ''}Run: ${context.name}`,
            context.folderURI.fsPath,
            process.env,
            {
                onSpawn: () => {
                    void commands.executeCommand('openshift.Serverless.refresh', context);
                },
                onExit: () => {
                    this.runTerminalMap.delete(`run-${context.folderURI.fsPath}`);
                    void commands.executeCommand('openshift.Serverless.refresh', context);
                }
            }, true
        );
        const session: FunctionSession = {
            sessionName: `${runBuild ? 'Build and ' : ''}Run: ${context.name}`,
            sessionPath: context.folderURI,
            teminal: terminal
        }
        this.addSession(context, session);
        void commands.executeCommand('openshift.Serverless.refresh', context);
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
            const result = await Odo.Instance.execute(ServerlessCommand.undeployFunction(context.name));
            if (result.error) {
                void window.showErrorMessage(result.error.message);
            } else {
                void commands.executeCommand('openshift.Serverless.refresh');
            }
        });
    }

    public async deploy(context: FunctionObject) {
        const executionContext: ExecutionContext = new ExecutionContext();
        const currentNamespace: string = await Oc.Instance.getActiveProject(executionContext);
        const yamlContent = await Utils.getFuncYamlContent(context.folderURI.fsPath);
        if (yamlContent) {
            const deployedNamespace = yamlContent.deploy?.namespace || undefined;
            if (!deployedNamespace || (deployedNamespace === currentNamespace)) {
                await this.deployProcess(context, deployedNamespace, yamlContent, executionContext);
            } else if (deployedNamespace !== currentNamespace) {
                const kind = await getNamespaceKind();
                const response = await window.showInformationMessage(`Function ${kind} (declared in func.yaml) is different from the current active ${kind}. Deploy function ${context.name} to current ${kind} ${currentNamespace}?`,
                    'Ok',
                    'Cancel');
                if (response === 'Ok') {
                    await this.deployProcess(context, currentNamespace, yamlContent, executionContext);
                }
            }
        }
    }

    private async deployProcess(context: FunctionObject, deployedNamespace: string, yamlContent: FunctionContent, executionContext: ExecutionContext) {
        if (!yamlContent.image || !Functions.imageRegex.test(yamlContent.image)) {
            void window.showErrorMessage(`Function ${context.name} has invalid imaage`)
            return;
        }
        const isOpenShift = await isOpenShiftCluster(executionContext);
        const buildImage = await this.getImage(context.folderURI);

        // fail after two failed login attempts
        let triedLoginTwice = false;

        const terminal = await OpenShiftTerminalManager.getInstance().createTerminal(
            ServerlessCommand.deployFunction(context.folderURI.fsPath, buildImage, deployedNamespace, isOpenShift),
            `Deploy: ${context.name}`,
            context.folderURI.fsPath,
            undefined,
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
            }, true
        );

        const session = {
            sessionName: `Deploy: ${context.name}`,
            sessionPath: context.folderURI,
            teminal: terminal
        };
        this.addSession(context, session);
        void commands.executeCommand('openshift.Serverless.refresh', context);
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
        await new Promise(resolve => { setTimeout(resolve, 100) });
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

    public async getImage(folderURI: Uri): Promise<string> {
        const yamlContent = await Utils.getFuncYamlContent(folderURI.fsPath);
        if (yamlContent?.image && Functions.imageRegex.test(yamlContent.image)) {
            return yamlContent.image
        }
        return null;
    }

    private async isDockerRunning(): Promise<DockerStatus> {
        return new Promise<DockerStatus>((resolve) => {
            try {
                const docker = new Dockerode();
                docker.ping((err) => {
                    if (err) {
                        resolve({
                            error: true,
                            message: 'Docker is not running, Please start the docker process'
                        });
                    }
                    resolve({
                        error: false,
                        message: ''
                    });
                });
            } catch {
                resolve({
                    error: true,
                    message: 'Docker not installed, Please install and start the docker process'
                });
            }
        });
    }

    private async isDockerOnPodman(): Promise<DockerStatus> {
        try {
            const resultRaw: CliExitData = await ChildProcessUtil.Instance.execute('podman info -f=json');
            if (resultRaw.stderr.toLowerCase().indexOf('cannot connect') !== -1) {
                return ({
                    error: true,
                    message: 'Docker is not running, Please start the docker process'
                });
            }
            const resultObj: { registries: { search: string[] } } = JSON.parse(resultRaw.stdout);
            if (resultObj.registries && !resultObj.registries.search?.includes('docker.io')) {
                return ({
                    error: true,
                    message: 'Docker is not running, Please start the docker process'
                });
            }
            return ({
                error: false,
                message: ''
            })
        } catch {
            return ({
                error: true,
                message: 'Docker not installed, Please install and start the docker process'
            });
        }
    }
}
