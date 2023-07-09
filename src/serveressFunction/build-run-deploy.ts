/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { EventEmitter, Uri, window } from 'vscode';
import { ClusterVersion, FunctionContent, FunctionObject, ImageAndBuild } from './types';
import { Command, Utils } from './commands';
import { Platform } from '../util/platform';
import { OdoImpl } from '../odo';
import { CliChannel } from '../cli';
import { ChildProcess, SpawnOptions } from 'child_process';

export class BuildAndDeploy {

    private static instance: BuildAndDeploy;

    private imageRegex = RegExp('[^/]+\\.[^/.]+\\/([^/.]+)(?:\\/[\\w\\s._-]*([\\w\\s._-]))*(?::[a-z0-9\\.-]+)?$');

    static getInstance(): BuildAndDeploy {
        if (!BuildAndDeploy.instance) {
            BuildAndDeploy.instance = new BuildAndDeploy();
        }
        return BuildAndDeploy.instance;
    }

    public async checkOpenShiftCluster(): Promise<ClusterVersion> {
        try {
            const result = await OdoImpl.Instance.execute(Command.getClusterVersion());
            if (result?.stdout?.trim()) {
                return JSON.parse(result?.stdout) as ClusterVersion;
            }
            return null;
        } catch (err) {
            return null;
        }
    }

    public async initBuildFunction(context: FunctionObject) {
        if (!context) {
            return null;
        }
        const uri = context.folderURI;
        const imageAndBuildModel = await this.getFunctionImageInteractively(uri);
        if (!imageAndBuildModel) {
            return null;
        }
        await this.buildFunction(context.name, uri.fsPath, imageAndBuildModel.image);
    }

    public async buildFunction(functionName: string, functionPath: string, buildImage: string): Promise<void> {
        const clusterVersion: ClusterVersion | null = await this.checkOpenShiftCluster();
        const outputEmitter = new EventEmitter<string>();
        let devProcess: ChildProcess;
        try {
            let terminal = window.createTerminal({
                name: `Build ${functionName}`,
                pty: {
                    onDidWrite: outputEmitter.event,
                    open: () => {
                        outputEmitter.fire(`Start Building ${functionName} \r\n`);
                        const opt: SpawnOptions = { cwd: functionPath };
                        void CliChannel.getInstance().spawnTool(Command.buildFunction(functionPath, buildImage, clusterVersion), opt).then((cp) => {
                            devProcess = cp;
                            devProcess.on('spawn', () => {
                                terminal.show();
                            });
                            devProcess.on('error', (err) => {
                                void window.showErrorMessage(err.message);
                            })
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
                        terminal = undefined;
                    },
                    handleInput: ((data: string) => {
                        if (!devProcess) { // if any key pressed after odo process ends
                            terminal.dispose();
                        } else if (data.charCodeAt(0) === 3) { // ctrl+C processed only once when there is no cleaning process
                            outputEmitter.fire('^C\r\n');
                            devProcess.kill('SIGINT');
                        }
                    })
                },
            });
        } catch (err) {
            //ignore
        }
    }

    public async runFunction(path: string, runBuild: string): Promise<ChildProcess> {
        return await CliChannel.getInstance().spawnTool(Command.runFunction(path, runBuild));
    }

    private async getFunctionImageInteractively(selectedFolderPick: Uri,
        forceImageStrategyPicker = false): Promise<ImageAndBuild> {
        const yamlContent = await Utils.getFuncYamlContent(selectedFolderPick.fsPath);
        return this.getImageAndBuildStrategy(yamlContent, forceImageStrategyPicker);
    }

    public async getImages(name: string, folder: Uri): Promise<string[]> {
        const defaultUsername = Platform.getEnv();
        let imageList: string[] = [];
        const defaultQuayImage = `quay.io/${Platform.getOS() === 'win32' ? defaultUsername.USERNAME : defaultUsername.USER}/${name}:latest`;
        const defaultDockerImage = `docker.io/${Platform.getOS() === 'win32' ? defaultUsername.USERNAME : defaultUsername.USER}/${name}:latest`;
        imageList.push(defaultQuayImage);
        imageList.push(defaultDockerImage);
        const yamlContent = await Utils.getFuncYamlContent(folder.fsPath);
        if (yamlContent?.image && this.imageRegex.test(yamlContent.image)) {
            imageList = [];
            imageList.push(yamlContent.image);
        }
        return imageList;
    }

    private async showInputBox(promptMessage: string, inputValidMessage: string, name?: string): Promise<string> {
        const defaultUsername = Platform.getEnv();
        const defaultImage = `quay.io/${Platform.getOS() === 'win32' ? defaultUsername.USERNAME : defaultUsername.USER}/${name}:latest`;
        return await window.showInputBox({
            ignoreFocusOut: true,
            prompt: promptMessage,
            value: defaultImage,
            validateInput: (value: string) => {
                if (!this.imageRegex.test(value)) {
                    return inputValidMessage;
                }
                return null;
            },
        });
    }

    private async getImageAndBuildStrategy(yamlContent: FunctionContent, forceImageStrategyPicker: boolean): Promise<ImageAndBuild> {
        const imageList: string[] = [];
        if (yamlContent?.image && this.imageRegex.test(yamlContent.image)) {
            imageList.push(yamlContent.image);
        }

        if (imageList.length === 1 && !forceImageStrategyPicker) {
            return { image: imageList[0] };
        }

        const strategies = [
            {
                label: 'Retrieve the image name from func.yaml or provide it',
            },
            { label: 'Autodiscover a registry and generate an image name using it.' },
        ];
        let strategy = strategies[0];
        if (forceImageStrategyPicker) {
            strategy = await window.showQuickPick(strategies, {
                canPickMany: false,
                ignoreFocusOut: true,
                placeHolder: 'Choose how the image name should be created',
            });

            if (!strategy) {
                return null;
            }
        }

        if (strategy === strategies[1]) {
            return { autoGenerateImage: true };
        }

        const imagePick =
            imageList.length === 1
                ? imageList[0]
                : await this.showInputBox(
                    'Provide full image name in the form [registry]/[namespace]/[name]:[tag] (e.g quay.io/boson/image:latest)',
                    'Provide full image name in the form [registry]/[namespace]/[name]:[tag] (e.g quay.io/boson/image:latest)',
                    yamlContent?.name,
                );
        if (!imagePick) {
            return null;
        }

        return { image: imagePick };
    }
}
