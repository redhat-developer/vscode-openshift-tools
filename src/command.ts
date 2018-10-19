/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as explorerFactory from './explorer';
import * as odoctl from './odo';
import { CliExitData } from './cli';
import * as opn from 'opn';
import * as isURL from 'validator/lib/isURL';
import * as progress from './progress';

export namespace Openshift {

    export const about = async (odo: odoctl.Odo) => {
        await odo.executeInTerminal(`odo version`, process.cwd());
    };

    export namespace Catalog {
        export const listComponents = function listComponentTypes(odo: odoctl.Odo) {
            odo.executeInTerminal(`odo catalog list components`, process.cwd());
        };
        export const listServices = function listComponentTypes(odo: odoctl.Odo) {
            odo.executeInTerminal(`odo catalog list services`, process.cwd());
        };
    }

    export namespace Project {

        export const projectNameValidation =  function projectName(value: string) {
            const characterRegex = /[a-z0-9]([-a-z0-9]*[a-z0-9])?/;
            if (value.trim().length === 0) {
                return 'Empty project name';
            } else if (!characterRegex.test(value)) {
                return 'Project name should be alphanumeric';
            } else if (!(value.trim().length <= 63)) {
                return 'Project name is to long';
            }
        };

        export const create = async function createProjectCmd(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer) {
            const projectName = await vscode.window.showInputBox({
                prompt: "Mention Project name",
                validateInput: (value: string) => {
                    return projectNameValidation(value);
                }
            });
            if (!projectName) return;
            Promise.resolve()
                .then(() => odo.execute(`odo project create ${projectName.trim()}`))
                .then(() => explorer.refresh())
                .catch((error) => vscode.window.showErrorMessage(`Failed to create project with error '${error}'`));
        };

        export const del = async function deleteProjectCmd(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject) {
            const value = await vscode.window.showWarningMessage(`Are you sure you want to delete project '${context.getName()}'?`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                Promise.resolve()
                    .then(() => odo.execute(`odo project delete ${context.getName()} -f`))
                    .then(() => {
                        explorer.refresh();
                        vscode.window.showInformationMessage(`Successfully deleted project '${context.getName()}'`);
                    }).catch((err) => vscode.window.showErrorMessage(`Failed to delete project with error '${err}'`));
            }
        };
    }

    export namespace Application {
        export const create = async function createApplicationCmd(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject) {
            const applicationName = await vscode.window.showInputBox({
                prompt: "Application name",
                validateInput: (value: string) => {
                    if (value.trim().length === 0) {
                        return 'Empty application name';
                    }
                }
            });
            if (!applicationName) return;
            Promise.resolve()
                .then(() => odo.execute(`odo project set ${context.getName()} && odo app create ${applicationName.trim()}`))
                .then(() => explorer.refresh(context))
                .catch((error) => vscode.window.showErrorMessage(`Failed to delete application with error '${error}'`));
        };

        export const describe = async function describe(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            const project: odoctl.OpenShiftObject = context.getParent();
            odo.executeInTerminal(`odo project set ${project.getName()}; odo app describe ${context.getName()}`, process.cwd());
        };

        export const del = async function deleteApplication(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject) {
            const project: odoctl.OpenShiftObject = context.getParent();
            const value = await vscode.window.showWarningMessage(`Are you sure you want to delete application '${context.getName()}?`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                Promise.resolve()
                    .then(() => odo.execute(`odo project set ${project.getName()} && odo app delete ${context.getName()} -f`))
                    .then(() => {
                        explorer.refresh(context.getParent());
                        vscode.window.showInformationMessage(`Successfully deleted application '${context.getName()}'`);
                    }).catch((err)=> vscode.window.showErrorMessage(`Failed to delete application with error '${err}'`));
            }
        };
    }

    export namespace Service {
        export const create = async function createService(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject)  {
            try {
                const serviceTemplateNames: string[] = await odo.getServiceTemplates();
                const serviceTemplateName = await vscode.window.showQuickPick(serviceTemplateNames, {
                    placeHolder: "Service Template Name"
                });
                if (serviceTemplateName) {
                    const serviceName = await vscode.window.showInputBox({
                        value: serviceTemplateName,
                        prompt: 'Service Name',
                        validateInput: (value: string) => {
                            // required, because dc name is ${component}-${app}
                            let message: string = null;
                            if (`${value.trim()}-${context.getName()}`.length > 63) {
                                message = 'Service name cannot be more that 63 characters';
                            }
                            return message;
                        }
                    });
                    if (serviceName) {
                        await progress.execWithProgress({
                            cancellable: false,
                            location: vscode.ProgressLocation.Notification,
                            title: `Creating new service '${serviceName}'`
                        }, [{command: `odo project set ${context.getParent().getName()} && odo app set ${context.getName()} && odo service create ${serviceTemplateName} ${serviceName.trim()}`, increment: 100}
                        ], odo).then(() => explorer.refresh(context));
                    }
                }
            } catch (e) {
                vscode.window.showErrorMessage(e.message.replace(/\w/, (c) => c.toUpperCase()));
            }
        };

        export const del = async function deleteService(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer, service: odoctl.OpenShiftObject, ) {
            const value = await vscode.window.showWarningMessage(`Are you sure you want to delete service '${service.getName()}'`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                await odo.execute(`odo project set ${service.getParent().getParent().getName()} && odo app set ${service.getParent().getName()} && odo service delete ${service.getName()} -f`);
                explorer.refresh(service.getParent());
            }
        };
    }

    export namespace Component {
        export const createLocal = async function createLocalComponent(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject) {
            try {
                const folder = await vscode.window.showWorkspaceFolderPick({
                    placeHolder: 'Select the target workspace folder'
                });

                if (!folder) return;

                const componentName = await vscode.window.showInputBox({
                    prompt: "Component name",
                    validateInput: (value: string) => {
                        if (value.trim().length === 0) {
                            return 'Empty component name';
                        }
                    }
                });

                if (!componentName) return;

                const componentTypeName = await vscode.window.showQuickPick(odo.getComponentTypes(), {placeHolder: "Component type"});

                if (!componentTypeName) return;

                const componentTypeVersion = await vscode.window.showQuickPick(odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type Version"});

                if (!componentTypeVersion) return;

                await progress.execWithProgress({
                    cancellable: false,
                    location: vscode.ProgressLocation.Notification,
                    title: `Creating new component '${componentName}'`
                }, [{command: `odo project set ${context.getParent().getName()} && odo app set ${context.getName()} && odo create ${componentTypeName}:${componentTypeVersion} ${componentName} --local ${folder.uri.fsPath}`, increment: 50},
                    {command: `odo project set ${context.getParent().getName()} && odo app set ${context.getName()} && odo component set ${componentName} && odo push --local ${folder.uri.fsPath}`, increment: 50}
                ], odo).then(()=>explorer.refresh(context));

            } catch (e) {
                vscode.window.showErrorMessage(e);
            }
        };

        export const createGit = async function createLocalComponent(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject) {
            try {
                const repoURI = await vscode.window.showInputBox({prompt: 'Git repository URI', validateInput:
                    (value: string) => {
                        if (value.trim().length === 0) {
                            return 'Empty Git repository URL';
                        }
                    }
                });

                if (!repoURI) return;

                const componentName = await vscode.window.showInputBox({prompt: "Component name", validateInput: (value: string) => {
                    if (value.trim().length === 0) {
                        return 'Empty component name';
                    }
                }});

                if (!componentName) return;

                const componentTypeName = await vscode.window.showQuickPick(odo.getComponentTypes(), {placeHolder: "Component type"});

                if (!componentTypeName) return;

                const componentTypeVersion = await vscode.window.showQuickPick(odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type Version"});

                if (!componentTypeVersion) return;

                vscode.window.showInformationMessage('Do you want to clone git repository for created component?', 'Yes', 'No').then((value) => {
                    value === 'Yes' && vscode.commands.executeCommand('git.clone', repoURI);
                });

                await progress.execWithProgress({
                    cancellable: false,
                    location: vscode.ProgressLocation.Notification,
                    title: `Creating new component '${componentName}'`
                }, [{command: `odo project set ${context.getParent().getName()} && odo app set ${context.getName()} && odo create ${componentTypeName}:${componentTypeVersion} ${componentName} --git ${repoURI}`, increment: 100}
                ], odo).then(()=>explorer.refresh(context));

            } catch (e) {
                vscode.window.showErrorMessage(e);
            }
        };

        export const create = async function createComponent(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject)  {
            // should use QuickPickItem with label and description
            const sourceTypes:vscode.QuickPickItem[] = [
            {
                label: 'Git Repository',
                description: 'Use an existing git repository as a source for the component'
            },
            {
                label: 'Workspace Directory',
                description: 'Use workspace directory as a source for the component'
            }];
            const componentSource = await vscode.window.showQuickPick(sourceTypes, {
                placeHolder: "Select source type for component"
            });
            if (componentSource.label === 'Git Repository' ) {
                createGit(odo, explorer, context);
            } else {
                createLocal(odo, explorer, context);
            }
        };

        export const del = async function deleteComponent(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject) {
            const app: odoctl.OpenShiftObject = context.getParent();
            const project: odoctl.OpenShiftObject = app.getParent();
            const value = await vscode.window.showWarningMessage(`Are you sure you want to delete component '${context.getName()}\'`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                Promise.resolve()
                    .then(() => odo.execute(`odo project set ${project.getName()} && odo app set ${app.getName()} && odo delete ${context.getName()} -f`))
                    .then(() => {
                        explorer.refresh(context.getParent());
                        vscode.window.showInformationMessage(`Successfully deleted component '${context.getName()}'`);
                    })
                    .catch((err)=> vscode.window.showErrorMessage(`Failed to delete component with error '${err}'`));
            }
        };

        export const describe = async function componentDescribe(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            const app: odoctl.OpenShiftObject = context.getParent();
            const project: odoctl.OpenShiftObject = app.getParent();
            odo.executeInTerminal(`odo project set ${project.getName()}; odo app set ${app.getName()}; odo describe ${context.getName()}`, process.cwd());
        };

        export const log = async function logComponent(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            const app: odoctl.OpenShiftObject = context.getParent();
            const project: odoctl.OpenShiftObject = app.getParent();
            odo.executeInTerminal(`odo project set ${project.getName()}; odo app set ${app.getName()}; odo log ${context.getName()};`, process.cwd());
        };

        export const followLog = async function followLogComponent(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            const app: odoctl.OpenShiftObject = context.getParent();
            const project: odoctl.OpenShiftObject = app.getParent();
            odo.executeInTerminal(`odo project set ${project.getName()}; odo app set ${app.getName()}; odo log ${context.getName()} -f;`, process.cwd());
        };

        export const push = async function pushCmd(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            const app: odoctl.OpenShiftObject = context.getParent();
            const project: odoctl.OpenShiftObject = app.getParent();

            await progress.execWithProgress({
                cancellable: false,
                location: vscode.ProgressLocation.Notification,
                title: `Pushing latest changes for component '${context.getName()}'`
            }, [{command: `odo project set ${project.getName()} && odo app set ${app.getName()} && odo component set  ${context.getName()} && odo push ${context.getName()}`, increment: 100}
            ], odo);
        };

        export const watch = async function watchCmd(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            const app: odoctl.OpenShiftObject = context.getParent();
            const project: odoctl.OpenShiftObject = app.getParent();
            odo.executeInTerminal(`odo project set ${project.getName()}; odo app set ${app.getName()}; odo component set ${context.getName()}; odo watch ${context.getName()};`, process.cwd());
        };

        export const openUrl = async function OpenUrlCmd(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            const app: odoctl.OpenShiftObject = context.getParent();
            const routeCheck = await odo.execute(`oc get route -o jsonpath="{range .items[?(.metadata.labels.app\\.kubernetes\\.io/component-name=='${context.getName()}')]}{.spec.host}{end}"`);
            let value = 'Create';
            if (routeCheck.stdout.trim() === '') {
                value = await vscode.window.showInformationMessage(`No URL for component '${context.getName()}\' in application '${app.getName()}\'. Do you want to create a route and open it?`, 'Create', 'Cancel');
                if (value === 'Create') {
                    await vscode.commands.executeCommand('openshift.url.create', context);
                }
            }
            if (value === 'Create') {
                const hostName = await odo.execute(`oc get route -o jsonpath="{range .items[?(.metadata.labels.app\\.kubernetes\\.io/component-name=='${context.getName()}')]}{.spec.host}{end}"`);
                const checkTls = await odo.execute(`oc get route -o jsonpath="{range .items[?(.metadata.labels.app\\.kubernetes\\.io/component-name=='${context.getName()}')]}{.spec.tls.termination}{end}"`);
                const tls = checkTls.stdout.trim().length === 0  ? "http://" : "https://";
                opn(`${tls}${hostName.stdout}`);
            }
        };

        export const openshiftConsole = async (context: odoctl.OpenShiftObject)=> {
            opn(context.getName());
        };
    }

    export namespace Url {
        export const create = async function createUrl(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            const app: odoctl.OpenShiftObject = context.getParent();
            const project: odoctl.OpenShiftObject = app.getParent();
            const portsResult: CliExitData = await odo.execute(`oc get service ${context.getName()}-${app.getName()} -o jsonpath="{range .spec.ports[*]}{.port}{','}{end}"`);
            let ports: string[] = portsResult.stdout.trim().split(',');
            ports = ports.slice(0, ports.length-1);
            let port: string = ports[0];
            if (ports.length > 1) {
                port = await vscode.window.showQuickPick(ports, {placeHolder: "Select port to expose"});
            }
            return Promise.resolve()
            .then(() => odo.execute(`odo project set ${project.getName()} && odo app set ${app.getName()} && odo component set ${context.getName()} && odo url create --port ${port}`))
            .catch((err) => {
                vscode.window.showErrorMessage(`Failed to create URL for component '${context.getName()}'!`);
            });
        };
    }

    export namespace Explorer {
        export const login = async function loginCluster(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer) {
            if (await odo.requireLogin()) {
                loginDialog(odo, explorer);
            } else {
                const value = await vscode.window.showInformationMessage(`You are already logged in the cluster. Do you want to login to a different cluster?`, 'Yes', 'No');
                if (value === 'Yes') {
                    odo.execute(`oc logout`).then(async (result)=> {
                        if (result.stderr === "") {
                            loginDialog(odo, explorer);
                        } else {
                            vscode.window.showErrorMessage(`Failed to logout of the current cluster with '${result.stderr}'!`);
                        }
                    }).catch((error) => vscode.window.showErrorMessage(`Failed to logout of the current cluster with '${error}'!`));
                }
            }
        };

        const loginDialog = async (odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer)=> {
            const clusterURL = await vscode.window.showInputBox({
                ignoreFocusOut: true,
                prompt: "Provide URL of the cluster to connect",
                validateInput: (value: string) => {
                    if (!isURL(value)) {
                        return 'Invalid URL provided';
                    }
                }
            });
            if (!clusterURL) return;
            const loginMethod = await vscode.window.showQuickPick(['Credentials', 'Token'], {placeHolder: 'Select the way to log in to the cluster.'});
            if (loginMethod === "Credentials") {
                credentialsLogin(clusterURL, odo, explorer);
            } else {
                tokenLogin(clusterURL, odo, explorer);
            }
        };

        const credentialsLogin = async (clusterURL, odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer)=> {
            const username = await vscode.window.showInputBox({
                ignoreFocusOut: true,
                prompt: "Provide Username for basic authentication to the API server",
                validateInput: (value: string) => {
                    if (value.trim().length === 0) {
                        return 'Invalid Username';
                    }
                }
            });
            if (!username) return;
            const passwd  = await vscode.window.showInputBox({
                ignoreFocusOut: true,
                password: true,
                prompt: "Provide Password for basic authentication to the API server"
            });
            if (!passwd) return;
            Promise.resolve()
                .then(() => odo.execute(`oc login ${clusterURL} -u ${username} -p ${passwd}`))
                .then((result) => loginMessage(clusterURL, result, explorer))
                .catch((error) => vscode.window.showErrorMessage(`Failed to login to cluster '${clusterURL}' with '${error}'!`));
        };

        const tokenLogin = async (clusterURL, odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer)=> {
            const ocToken  = await vscode.window.showInputBox({
                prompt: "Provide Bearer token for authentication to the API server",
                ignoreFocusOut: true
            });
            Promise.resolve()
                .then(() => odo.execute(`oc login ${clusterURL} --token=${ocToken}`))
                .then((result) => loginMessage(clusterURL, result, explorer))
                .catch((error) => vscode.window.showErrorMessage(`Failed to login to cluster '${clusterURL}' with '${error}'!`));
        };

        const loginMessage = async (clusterURL, result, explorer)=> {
            if (result.stderr === "") {
                explorer.refresh();
                vscode.commands.executeCommand('setContext', 'isLoggedIn', true);
                vscode.window.showInformationMessage(`Successfully logged in to '${clusterURL}'`);
            } else {
                vscode.window.showErrorMessage(`Failed to login to cluster '${clusterURL}' with '${result.stderr}'!`);
            }
        };

        export const logout = async function logout(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer) {
            const value = await vscode.window.showWarningMessage(`Are you sure you want to logout of cluster`, 'Logout', 'Cancel');
            if (value === 'Logout') {
                odo.execute(`oc logout`).then(async (result)=> {
                    if (result.stderr === "") {
                        explorer.refresh();
                        vscode.commands.executeCommand('setContext', 'isLoggedIn', false);
                        const logoutInfo = await vscode.window.showInformationMessage(`Successfully logged out. Do you want to login to a new cluster`, 'Yes', 'No');
                        if (logoutInfo === 'Yes') {
                            login(odo, explorer);
                        }
                    }
                }).catch((error) => {
                        vscode.window.showErrorMessage(`Failed to logout of the current cluster with '${error}'!`);
                });
            }
        };

        export const refresh = function refresh(explorer: explorerFactory.OpenShiftExplorer) {
            explorer.refresh();
        };
    }

    export namespace Storage {
        export const create = async function createStorage(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject) {
            const app: odoctl.OpenShiftObject = context.getParent();
            const project: odoctl.OpenShiftObject = app.getParent();
            const storageName = await vscode.window.showInputBox({prompt: "Specify the storage name", validateInput: (value: string) => {
                if (value.trim().length === 0) {
                    return 'Invalid storage name';
                }
            }});
            if (!storageName) return;

            const mountPath = await vscode.window.showInputBox({prompt: "Specify the mount path", validateInput: (value: string) => {
                if (value.trim().length === 0) {
                    return 'Invalid mount path';
                }
            }});
            if (!mountPath) return;

            const storageSize = await vscode.window.showQuickPick(['1Gi', '1.5Gi', '2Gi'], {placeHolder: 'Select the storage size'});
            Promise.resolve()
                .then(() => odo.execute(`odo project set ${project.getName()} && odo app set ${app.getName()} && odo component set ${context.getName()} && odo storage create ${storageName} --path=${mountPath} --size=${storageSize}`))
                .then(() => explorer.refresh(context))
                .catch((e: Error) => vscode.window.showErrorMessage(`New Storage command failed with error: '${e}'!`));
        };

        export const del = async function deleteStorage(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject) {
            const component: odoctl.OpenShiftObject = context.getParent();
            const app: odoctl.OpenShiftObject = component.getParent();
            const project: odoctl.OpenShiftObject = app.getParent();
            const value = await vscode.window.showWarningMessage(`Are you sure you want to delete storage '${context.getName()}' from component '${component.getName()}'?`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                Promise.resolve()
                    .then(() => odo.execute(`odo project set ${project.getName()} && odo app set ${app.getName()} && odo component set ${component.getName()} && odo storage delete ${context.getName()} -f`))
                    .then(() => {
                        explorer.refresh(context);
                        vscode.window.showInformationMessage(`Successfully deleted storage '${context.getName()}' from component '${component.getName()}`);
                    }).catch((err) => vscode.window.showErrorMessage(`Failed to delete storage with error '${err}'`));
            }
        };
    }
}
