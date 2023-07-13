/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as fs from 'fs/promises';
import * as path from 'path';
import * as tmp from 'tmp';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { Uri, ViewColumn, WebviewPanel, extensions, window } from 'vscode';
import * as YAML from 'yaml';
import { OdoImpl } from '../../odo';
import { AnalyzeResponse, ComponentTypeDescription, Registry } from '../../odo/componentType';
import { Endpoint } from '../../odo/componentTypeDescription';
import OpenShiftItem from '../../openshift/openshiftItem';
import { ComponentTypesView } from '../../registriesView';
import { ExtensionID } from '../../util/constants';
import { selectWorkspaceFolder } from '../../util/workspace';
import { VsCommandError } from '../../vscommand';
import { loadWebviewHtml } from '../common-ext/utils';
import { Devfile, DevfileRegistry, TemplateProjectIdentifier } from '../common/devfile';
import { DevfileConverter } from '../git-import/devfileConverter';
import { gitUrlParse } from '../git-import/gitParse';
import cp = require('child_process');
import fsExtra = require('fs-extra');

interface CloneProcess {
    status: boolean,
    error: string | undefined
}

type Message = {
    action: string;
    data: any;
};

export default class CreateComponentLoader {
    static panel: WebviewPanel;

    static get extensionPath() {
        return extensions.getExtension(ExtensionID).extensionPath;
    }

    static async loadView(title: string): Promise<WebviewPanel> {
        const localResourceRoot = Uri.file(
            path.join(CreateComponentLoader.extensionPath, 'out', 'createComponentViewer'),
        );

        let panel = window.createWebviewPanel('createComponentView', title, ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [localResourceRoot],
            retainContextWhenHidden: true,
        });

        const messageHandlerDisposable = panel.webview.onDidReceiveMessage(
            CreateComponentLoader.messageHandler,
        );

        const colorThemeDisposable = vscode.window.onDidChangeActiveColorTheme(async function (
            colorTheme: vscode.ColorTheme,
        ) {
            await panel.webview.postMessage({ action: 'setTheme', themeValue: colorTheme.kind });
        });

        panel.onDidDispose(() => {
            colorThemeDisposable.dispose();
            messageHandlerDisposable.dispose();
            panel = undefined;
        });

        panel.iconPath = Uri.file(
            path.join(CreateComponentLoader.extensionPath, 'images/context/cluster-node.png'),
        );
        panel.webview.html = await loadWebviewHtml('createComponentViewer', panel);
        CreateComponentLoader.panel = panel;
        return panel;
    }

    /**
     * Respond to messages from the webview.
     */
    static async messageHandler(message: Message) {
        switch (message.action) {
            /**
             * The panel has successfully loaded. Send the kind of the current color theme to update the theme.
             */
            case 'init': {
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'setTheme',
                    themeValue: vscode.window.activeColorTheme.kind,
                });
                break;
            }
            /**
             * The panel requested the list of devfile registries with their devfiles. Respond with this list.
             */
            case 'getDevfileRegistries': {
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'devfileRegistries',
                    data: CreateComponentLoader.getDevfileRegistries(),
                });
                break;
            }
            /**
             * The panel requested the list of workspace folders. Respond with this list.
             */
            case 'getWorkspaceFolders': {
                if (vscode.workspace.workspaceFolders !== undefined) {
                    let workspaceFolderUris: Uri[] = vscode.workspace.workspaceFolders.map(
                        (wsFolder) => wsFolder.uri,
                    );
                    workspaceFolderUris.filter((uri) => !isDevfileExists(uri));
                    void CreateComponentLoader.panel.webview.postMessage({
                        action: 'workspaceFolders',
                        data: workspaceFolderUris,
                    });
                }
                break;
            }
            /**
             * The panel requested to validate the entered component name. Respond with error status and message.
             */
            case 'validateComponentName': {
                CreateComponentLoader.validateComponentName(message.data);
                break;
            }
            /**
             * The panel requested to select a project folder.
             */
            case 'selectProjectFolder': {
                const workspaceUri: Uri = await selectWorkspaceFolder(true);
                let workspaceFolderUris: Uri[] = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map((wsFolder) => wsFolder.uri) : [];
                workspaceFolderUris.push(workspaceUri);
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'devfileExists',
                    data: await isDevfileExists(workspaceUri)
                });
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'workspaceFolders',
                    data: workspaceFolderUris
                });
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'selectedProjectFolder',
                    data: workspaceUri.fsPath,
                });
                break;
            }
            case 'selectProjectFolderNewProject': {
                const workspaceUri: vscode.Uri = await selectWorkspaceFolder(true);
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'selectedProjectFolder',
                    data: workspaceUri.fsPath,
                });
                break;
            }
            /**
             * The panel requested to get the receommended devfile given the selected project.
             */
            case 'getRecommendedDevfile': {
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'devfileExists',
                    data: await isDevfileExists(Uri.file(message.data)),
                });
                CreateComponentLoader.getRecommendedDevfile(Uri.file(message.data));
                break;
            }
            case 'isValidProjectFolder': {
                const { folder, componentName } = message.data;
                let projectFolderExists = false;
                try {

                    const stats = await fs.stat(folder);
                    projectFolderExists = stats.isDirectory();
                } catch (_) {
                    // do nothing
                }

                let projectFolderWritable = false;
                if (projectFolderExists) {
                    try {
                        await fs.access(folder, fs.constants.W_OK);
                        projectFolderWritable = true;
                    } catch (_) {
                        // do nothing
                    }
                }

                const childFolder = path.join(folder, componentName);
                let childFolderExists = false;
                if (projectFolderExists && projectFolderWritable) {
                    try {
                        await fs.access(childFolder);
                        childFolderExists = true;
                    } catch (_) {
                        // do nothing
                    }
                }

                let validationMessage = '';
                if (!projectFolderExists) {
                    validationMessage = `Project folder ${folder} doesn't exist`;
                } else if (!projectFolderWritable) {
                    validationMessage = `Project folder ${folder} is not writable`;
                } else if (childFolderExists) {
                    validationMessage = `There is already a folder ${componentName} in ${folder}`;
                } else {
                    validationMessage = `Project will be created in ${childFolder}`;
                }

                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'isValidProjectFolder',
                    data: {
                        valid: projectFolderExists && projectFolderWritable && !childFolderExists,
                        message: validationMessage,
                    },
                });
                break;
            }
            case 'createComponentFromTemplateProject': {
                const { projectFolder, componentName } = message.data;
                const templateProject: TemplateProjectIdentifier = message.data.templateProject;
                const componentFolder = path.join(projectFolder, componentName);
                try {
                    await fs.mkdir(componentFolder);
                    await OdoImpl.Instance.createComponentFromTemplateProject(
                        componentFolder,
                        componentName,
                        templateProject.devfileId,
                        templateProject.registryName,
                        templateProject.templateProjectName,
                    );
                    CreateComponentLoader.panel.dispose();
                    const ADD_TO_WORKSPACE = 'Add to workspace';
                    const selection = await vscode.window.showInformationMessage(
                        `Component '${componentName} was created.`,
                        ADD_TO_WORKSPACE,
                    );
                    if (selection === ADD_TO_WORKSPACE) {
                        vscode.workspace.updateWorkspaceFolders(
                            vscode.workspace.workspaceFolders
                                ? vscode.workspace.workspaceFolders.length
                                : 0,
                            null,
                            { uri: Uri.file(componentFolder) },
                        );
                    }
                } catch (e) {
                    void vscode.window.showErrorMessage(e);
                }
                break;
            }
            /**
             * The panel requested to get the receommended devfile given the selected project.
             */
            case 'getRecommendedDevfileFromGit': {
                const tmpFolder: Uri = Uri.parse(await promisify(tmp.dir)());
                const cloneProcess: CloneProcess = await clone(message.data, tmpFolder.fsPath);
                if (!cloneProcess.status && cloneProcess.error) {
                    void CreateComponentLoader.panel.webview.postMessage({
                        action: 'cloneFailed',
                    });
                }
                CreateComponentLoader.getRecommendedDevfile(tmpFolder);
                break;
            }
            /**
             * The panel requested to create component from local codebase or git repo.
             */
            case 'createComponent': {
                let projectUri: Uri;
                const componentName: string = message.data.componentName;

                if (message.data.path) {
                    // path of project in local codebase
                    projectUri = Uri.file(message.data.path);
                } else if (message.data.gitDestinationPath) {
                    // move the cloned git repo to selected project path
                    const newProjectPath: string = path.join(message.data.gitDestinationPath, componentName);
                    await fs.mkdir(newProjectPath);
                    await fsExtra.copy(message.data.tmpDirUri.fsPath, newProjectPath);
                    await fs.rm(message.data.tmpDirUri.fsPath, { force: true, recursive: true });
                    projectUri = Uri.file(newProjectPath);
                }

                try {
                    await OdoImpl.Instance.createComponentFromFolder(getDevfileType(message.data.devfileDisplayName), undefined, componentName, projectUri);
                    CreateComponentLoader.panel.dispose();
                    vscode.commands.executeCommand('openshift.componentsView.refresh');
                    window.showInformationMessage(`Component '${componentName}' was successfully created. Perform actions on it from Components View.`);
                    vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, null, { uri: projectUri });
                    break;
                } catch (err) {
                    if (err instanceof VsCommandError) {
                        throw new VsCommandError(
                            `Error occurred while creating Component '${componentName}': ${err.message}`,
                            `Error occurred while creating Component: ${err.telemetryMessage}`, err,
                        );
                    }
                    throw err;
                }
            }
            /**
             * The panel requested to validate the git repository URL.
             */
            case 'validateGitURL': {
                validateGitURL(message);
                break;
            }
            /**
             * The panel requested to validate a folder path.
             */
            case 'validateFolderPath': {
                await validateFolderPath(message.data);
                break;
            }
        }
    }

    static getDevfileRegistries(): DevfileRegistry[] {
        const registries = ComponentTypesView.instance.getListOfRegistries();
        if (!registries || registries.length === 0) {
            throw new Error('No Devfile registries available. Default registry is missing');
        }
        const devfileRegistries = registries.map((registry: Registry) => {
            return {
                devfiles: [],
                name: registry.name,
                url: registry.url,
            } as DevfileRegistry;
        });

        const components = ComponentTypesView.instance.getCompDescriptions();
        for (const component of components) {
            const devfileRegistry = devfileRegistries.find(
                (devfileRegistry) => devfileRegistry.url === component.registry.url.toString(),
            );

            devfileRegistry.devfiles.push({
                description: component.description,
                registryName: devfileRegistry.name,
                logoUrl: component.devfileData.devfile.metadata.icon,
                name: component.displayName,
                id: component.name,
                starterProjects: component.devfileData.devfile.starterProjects,
                tags: component.tags,
                yaml: YAML.stringify(component.devfileData.devfile),
                supportsDebug:
                    Boolean(
                        component.devfileData.devfile.commands?.find(
                            (command) => command.exec?.group?.kind === 'debug',
                        ),
                    ) ||
                    Boolean(
                        component.devfileData.devfile.commands?.find(
                            (command) => command.composite?.group?.kind === 'debug',
                        ),
                    ),
                supportsDeploy:
                    Boolean(
                        component.devfileData.devfile.commands?.find(
                            (command) => command.exec?.group?.kind === 'deploy',
                        ),
                    ) ||
                    Boolean(
                        component.devfileData.devfile.commands?.find(
                            (command) => command.composite?.group?.kind === 'deploy',
                        ),
                    ),
            } as Devfile);
        }
        devfileRegistries.sort((a, b) => (a.name < b.name ? -1 : 1));
        return devfileRegistries;
    }

    static validateComponentName(data: string) {
        let validationMessage = OpenShiftItem.emptyName(`Please enter a component name.`, data);
        if (!validationMessage)
            validationMessage = OpenShiftItem.validateMatches(
                `Not a valid component name.
            Please use lower case alphanumeric characters or '-', start with an alphabetic character, and end with an alphanumeric character`,
                data,
            );
        if (!validationMessage)
            validationMessage = OpenShiftItem.lengthName(
                `Component name should be between 2-63 characters`,
                data,
                0,
            );
        void CreateComponentLoader.panel.webview.postMessage({
            action: 'validatedComponentName',
            data: validationMessage,
        });
    }

    static async getRecommendedDevfile(uri: Uri) {
        let analyzeRes: AnalyzeResponse[] = [];
        let compDescriptions: ComponentTypeDescription[] = [];
        try {
            analyzeRes = await OdoImpl.Instance.analyze(uri.fsPath);
            compDescriptions = getCompDescription(analyzeRes);
        } catch (error) {
            if (error.message.toLowerCase().indexOf('failed to parse the devfile') !== -1) {
                CreateComponentLoader.panel?.webview.postMessage({
                    action: 'devfileFailed',
                });
                const actions: Array<string> = ['Yes', 'Cancel'];
                const devfileRegenerate = await vscode.window.showInformationMessage(
                    'We have detected that the repo contains configuration based on devfile v1. The extension does not support devfile v1, will you be okay to regenerate a new devfile v2?',
                    ...actions,
                );
                if (devfileRegenerate === 'Yes') {
                    try {
                        const devFileV1Path = path.join(uri.fsPath, 'devfile.yaml');
                        const file = await fs.readFile(devFileV1Path, 'utf8');
                        const devfileV1 = YAML.parse(file.toString());
                        await fs.unlink(devFileV1Path);
                        analyzeRes = await OdoImpl.Instance.analyze(uri.fsPath);
                        compDescriptions = getCompDescription(analyzeRes);
                        const endPoints = getEndPoints(compDescriptions[0]);
                        const devfileV2 = await DevfileConverter.getInstance().devfileV1toDevfileV2(
                            devfileV1,
                            endPoints,
                        );
                        const yaml = YAML.stringify(devfileV2, { sortMapEntries: true });
                        await fs.writeFile(devFileV1Path, yaml.toString(), 'utf-8');
                        CreateComponentLoader.panel?.webview.postMessage({
                            action: 'devfileRegenerated',
                        });
                    } catch (e) {
                        vscode.window.showErrorMessage(
                            'Failed to parse devfile v1, Unable to proceed the component creation',
                        );
                    }
                } else {
                    vscode.window.showErrorMessage(
                        'Devfile version not supported, Unable to proceed the component creation',
                    );
                }
            } else {
                compDescriptions = getCompDescription(analyzeRes);
            }
        } finally {
            const devfileRegistry: DevfileRegistry[] = CreateComponentLoader.getDevfileRegistries();
            const allDevfiles: Devfile[] = devfileRegistry
                .map((registry) => registry.devfiles)
                .flat();
            const devfile: Devfile = allDevfiles.find(
                (devfile) => devfile.name === compDescriptions[0].displayName,
            );
            void CreateComponentLoader.panel.webview.postMessage({
                action: 'recommendedDevfile',
                data: {
                    devfile: devfile,
                    tmpDir: uri
                }
            });
        }
    }
}

function getCompDescription(devfiles: AnalyzeResponse[]): ComponentTypeDescription[] {
    const compDescriptions = ComponentTypesView.instance.getCompDescriptions();
    if (devfiles.length === 0) {
        return Array.from(compDescriptions);
    }
    return Array.from(compDescriptions).filter(({ name, version, registry }) =>
        devfiles.some(
            (res) =>
                res.devfile === name &&
                res.devfileVersion === version &&
                res.devfileRegistry === registry.name,
        ),
    );
}

function getDevfileType(devfileDisplayName: string): string {
    const compDescriptions: Set<ComponentTypeDescription> = ComponentTypesView.instance.getCompDescriptions();
    const devfileDescription: ComponentTypeDescription = Array.from(compDescriptions).find((description) => description.displayName === devfileDisplayName);
    return devfileDescription.name;
}

function getEndPoints(compDescription: ComponentTypeDescription): Endpoint[] {
    return compDescription.devfileData.devfile.components[0].container.endpoints;
}

async function isDevfileExists(uri: vscode.Uri): Promise<boolean> {
    if ((await fs.stat(uri.fsPath)).isDirectory()) {
        const devFileYamlPath = path.join(uri.fsPath, 'devfile.yaml');
        try {
            await fs.access(devFileYamlPath);
            return true;
        } catch {
            return false;
        }
    }
}

function validateGitURL(event: any) {
    if (event.data.trim().length === 0) {
        CreateComponentLoader.panel?.webview.postMessage({
            action: event.action,
            data: {
                isValid: false,
                helpText: 'Please enter a Git URL.'
            }
        });
    } else {
        try {
            const parse = gitUrlParse(event.data);
            const isGitRepo = isGitURL(parse.host);
            if (!isGitRepo) {
                throw 'Invalid Git URL';
            }
            if (parse.organization !== '' && parse.name !== '') {
                CreateComponentLoader.panel?.webview.postMessage({
                    action: event.action,
                    data: {
                        isValid: true,
                        helpText: 'The git repo URL is valid.'
                    }
                });
            } else {
                CreateComponentLoader.panel?.webview.postMessage({
                    action: event.action,
                    data: {
                        isValid: true,
                        helpText: 'URL is valid but cannot be reached.'
                    }
                });
            }
        } catch (e) {
            CreateComponentLoader.panel?.webview.postMessage({
                action: event.action,
                data: {
                    isValid: false,
                    helpText: 'Invalid Git URL.'
                }
            });
        }
    }
}

function isGitURL(host: string): boolean {
    return ['github.com', 'bitbucket.org', 'gitlab.com'].includes(host);
}

function clone(url: string, location: string): Promise<CloneProcess> {
    const gitExtension = vscode.extensions.getExtension('vscode.git').exports;
    const git = gitExtension.getAPI(1).git.path;
    // run 'git clone url location' as external process and return location
    return new Promise((resolve, reject) => (cp.exec(`${git} clone ${url} ${location}`,
        (error: cp.ExecException) => {
            error ? resolve({ status: false, error: error.message }) : resolve({ status: true, error: undefined });
        }
    )));
}

async function validateFolderPath(path: string) {
    let isValid: boolean = true;
    let helpText: string = '';
    if ((await fs.stat(path)).isDirectory()) {
        try {
            await fs.access(path);
        } catch {
            isValid = false;
            helpText = 'Please enter a valid directory path.';
        }
        CreateComponentLoader.panel?.webview.postMessage({
            action: 'validatedFolderPath',
            data: {
                isValid: isValid,
                helpText: helpText
            }
        });
    }
}
