/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as fs from 'fs/promises';
import * as path from 'path';
import { ColorTheme, Disposable, Uri, ViewColumn, WebviewPanel, commands, extensions, window, workspace } from 'vscode';
import { Registry } from '../../odo/componentType';
import { Odo } from '../../odo/odoWrapper';
import { ComponentTypesView } from '../../registriesView';
import sendTelemetry from '../../telemetry';
import { ExtensionID } from '../../util/constants';
import { getInitialWorkspaceFolder, selectWorkspaceFolder } from '../../util/workspace';
import { vsCommand } from '../../vscommand';
import { isValidProjectFolder, sendDevfileForVersion, sendUpdatedCapabilities, sendUpdatedDevfileInfos, sendUpdatedRegistries, sendUpdatedTags, validateName, validatePortNumber } from '../common-ext/createComponentHelpers';
import { loadWebviewHtml } from '../common-ext/utils';
import { TemplateProjectIdentifier } from '../common/devfile';

window.onDidChangeActiveColorTheme(function (editor: ColorTheme) {
    if (RegistryViewLoader.panel) {
        void RegistryViewLoader.panel.webview.postMessage({
            action: 'setTheme',
            themeValue: window.activeColorTheme.kind,
        });
    }
});

async function devfileRegistryViewerMessageListener(event: any): Promise<any> {
    switch (event?.action) {
        case 'init':
            void RegistryViewLoader.panel.webview.postMessage({
                    action: 'setTheme',
                    themeValue: window.activeColorTheme.kind,
                });
            break;
        case 'getDevfileRegistries':
            await sendUpdatedRegistries(RegistryViewLoader.panel, RegistryViewLoader.url);
            break;
        case 'getDevfileInfos':
            await sendUpdatedDevfileInfos(RegistryViewLoader.panel, RegistryViewLoader.url);
            break;
        case 'getDevfile':
            await sendDevfileForVersion(RegistryViewLoader.panel, event?.data?.devfileInfo, event?.data?.version);
            break;
        case 'getDevfileCapabilities':
            sendUpdatedCapabilities(RegistryViewLoader.panel);
            break;
        case 'getDevfileTags':
            await sendUpdatedTags(RegistryViewLoader.panel, RegistryViewLoader.url);
            break;
        case 'createComponent': {
            const { projectFolder, componentName } = event.data;
            const templateProject: TemplateProjectIdentifier = event.data.templateProject;
            const devfileVersion = event.data.devfileVersion && event.data.devfileVersion.length > 0 ?
                                event.data.devfileVersion : 'latest';
            const portNumber: number = event.data.portNumber;
            const componentFolder = path.join(projectFolder, componentName);
            try {
                await fs.mkdir(componentFolder);
                await Odo.Instance.createComponentFromTemplateProject(
                    componentFolder,
                    componentName,
                    portNumber,
                    templateProject.devfileId,
                    devfileVersion,
                    templateProject.registryName,
                    templateProject.templateProjectName,
                );
                RegistryViewLoader.panel.dispose();
                if (
                    event.data.addToWorkspace &&
                    !workspace.workspaceFolders?.some(
                        (workspaceFolder) => workspaceFolder.uri.fsPath === componentFolder,
                    )
                ) {
                    workspace.updateWorkspaceFolders(
                        workspace.workspaceFolders
                            ? workspace.workspaceFolders.length
                            : 0,
                        null,
                        { uri: Uri.file(componentFolder) },
                    );
                }
                void commands.executeCommand('openshift.componentsView.refresh');
            } catch (e) {
                void window.showErrorMessage(e);
            }
            break;
        }
        /**
         * The panel requested the root workspace folder.
         * Once the  `vscode.workspace.rootPath` is deprected, we'll use the first path
         * from the list of workspace folders as the initial one.
         * Respond with this folder path.
         */
        case 'getInitialWokspaceFolder': {
            const initialWorkspaceFolder = getInitialWorkspaceFolder();
            if (initialWorkspaceFolder) {
                void RegistryViewLoader.panel.webview.postMessage({
                    action: 'initialWorkspaceFolder',
                    data: initialWorkspaceFolder
                });
            }
            break;
        }
        case 'validateComponentName': {
            const validationMessage = validateName(event.data);
            void RegistryViewLoader.panel.webview.postMessage({
                action: 'validatedComponentName',
                data: validationMessage,
            });
            break;
        }
        /**
         * The panel requested to validate the entered port number. Respond with error status and message.
         */
        case 'validatePortNumber': {
            const validationMessage = validatePortNumber(event.data);
            void RegistryViewLoader.panel.webview.postMessage({
                action: 'validatePortNumber',
                data: validationMessage,
            });
            break;
        }
        case 'selectProjectFolderNewProject': {
            const workspaceUri: Uri = await selectWorkspaceFolder(true, undefined, undefined,  event?.data );
            if (workspaceUri) {
                void RegistryViewLoader.panel.webview.postMessage({
                    action: 'selectedProjectFolder',
                    data: workspaceUri.fsPath,
                });
            }
            break;
        }
        case 'isValidProjectFolder': {
            const { folder, componentName } = event.data;
            const validationResult = await isValidProjectFolder(folder, componentName);
            void RegistryViewLoader.panel.webview.postMessage({
                action: 'isValidProjectFolder',
                data: validationResult,
            });
            break;
        }

        /**
         * Send a telemetry message
         */
        case 'sendTelemetry': {
            const actionName: string = event.data.actionName;
            const properties: {[key: string]: string} = event.data.properties;
            void sendTelemetry(actionName, properties);
            break;
        }

        default: {
            void window.showErrorMessage(`OpenShift: Unexpected message in registry view loader ${event?.action}`);
        }
    }
}

export default class RegistryViewLoader implements Disposable {
    private static instance: RegistryViewLoader;

    public static getInstance(): RegistryViewLoader {
        if (!RegistryViewLoader.instance) {
            RegistryViewLoader.instance = new RegistryViewLoader();
        }
        return RegistryViewLoader.instance;
    }

    dispose() { }

    static panel: WebviewPanel;
    static url: string;

    static get extensionPath() {
        return extensions.getExtension(ExtensionID).extensionPath
    }

    private static doUpdateRegistries() {
        void sendUpdatedRegistries(RegistryViewLoader.panel).then((registries) => {
            if (RegistryViewLoader.url) { // Update title if registry name for the URL provided has changed
                const registryName = registries.find((registry) => registry.url === RegistryViewLoader.url)?.name;
                if (registryName) {
                    RegistryViewLoader.panel.title = `Devfile Registry - ${registryName}`;
                } else {
                    void RegistryViewLoader.panel.webview.postMessage({
                        action: 'createComponentFailed',
                        data: `No Devfile registries available for ${RegistryViewLoader.url}`
                    });
                    void window.showErrorMessage(
                            `
                            No Devfile registry available.
                            Do you want to close the '${RegistryViewLoader.panel.title}' view?
                            `,
                            'Yes', 'No')
                        .then((answer) => {
                            if (answer === 'Yes') {
                                void RegistryViewLoader.closeRegistryInWebview();
                            }
                        });
                }
            }
        })
    }

    static async loadView(title: string, url?: string): Promise<WebviewPanel> {
        const localResourceRoot = Uri.file(path.join(RegistryViewLoader.extensionPath, 'out', 'devfile-registry', 'app'));
        if (RegistryViewLoader.panel) {
            if (RegistryViewLoader.url !== url) {
                RegistryViewLoader.url = url;
                RegistryViewLoader.doUpdateRegistries();
            }
            // If we already have a panel, show it in the target column
            RegistryViewLoader.panel.reveal(ViewColumn.One);
            RegistryViewLoader.panel.title = title;
        } else {
            RegistryViewLoader.url = url;
            RegistryViewLoader.panel = window.createWebviewPanel('devFileRegistryView', title, ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true
            });
            RegistryViewLoader.panel.iconPath = Uri.file(path.join(RegistryViewLoader.extensionPath, 'images/context/devfile.png'));
            RegistryViewLoader.panel.webview.html = await loadWebviewHtml('devfile-registry', RegistryViewLoader.panel);
            const messageDisposable = RegistryViewLoader.panel.webview.onDidReceiveMessage(devfileRegistryViewerMessageListener);

            const registriesSubscription = ComponentTypesView.instance.subject.subscribe(() => {
                RegistryViewLoader.doUpdateRegistries();
            });

            const capabiliiesySubscription = ComponentTypesView.instance.subject.subscribe(() => {
                sendUpdatedCapabilities(RegistryViewLoader.panel);
            });

            const tagsSubscription = ComponentTypesView.instance.subject.subscribe(() => {
                void sendUpdatedTags(RegistryViewLoader.panel);
            });

            RegistryViewLoader.panel.onDidDispose(() => {
                tagsSubscription.unsubscribe();
                capabiliiesySubscription.unsubscribe();
                registriesSubscription.unsubscribe();
                messageDisposable.dispose();
                RegistryViewLoader.panel = undefined;
            });
        }

        return RegistryViewLoader.panel;
    }

    @vsCommand('openshift.componentTypesView.registry.openInView')
    public static async openRegistryInWebview(): Promise<void> {
        await RegistryViewLoader.loadView('Devfile Registry');
    }

    @vsCommand('openshift.componentTypesView.registry.openInEditor')
    public static async openRegistryInEditor(context: Registry): Promise<void> {
        await RegistryViewLoader.loadView(`Devfile Registry - ${context.name}`, context.url);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    @vsCommand('openshift.componentTypesView.registry.closeView')
    static closeRegistryInWebview(): Promise<void> {
        RegistryViewLoader.panel?.dispose();
        return Promise.resolve();
    }
}
