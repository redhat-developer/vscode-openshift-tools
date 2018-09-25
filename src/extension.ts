'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as explorerFactory from './explorer';
import * as cli from './cli';
import * as odoctl from './odo';
import { CliExitData } from './cli';
import * as opn from 'opn';
import * as isURL from 'validator/lib/isURL';

export namespace Openshift {

    export const about = async function (odo: odoctl.Odo) {
        const result:CliExitData = await odo.executeInTerminal(`odo version`, process.cwd());
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
        export const create = async function createProjectCmd(cli: cli.ICli, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject) {
            const value  = await vscode.window.showInputBox({prompt: "Project name"});
            await cli.execute(`odo project create ${value.trim()}`, {});
            await explorer.refresh();
        };
        export const del = async function deleteProjectCmd(cli: cli.ICli, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject) {
            const value = await vscode.window.showWarningMessage(`Are you sure you want to delete project '${context.getName()}\'`, 'Yes', 'Cancel');
            if(value === 'Yes') {
                await cli.execute(`odo project delete ${context.getName()} -f`, {}).then(()=>{
                    explorer.refresh();
                }).catch((err)=>{
                    vscode.window.showErrorMessage(`Project deletion failed with error '${err}'`);
                });
            }
        };
    }

    export namespace Application {
        export const create = async function createApplicationCmd(cli: cli.ICli, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject) {
            vscode.window.showInputBox({prompt: "Application name"}).then(value=> {
                cli.execute(`odo app create ${value.trim()}`, {}).then(()=>{
                    explorer.refresh();
                });
            });
        };

        export const describe = async function describe(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            let project: odoctl.OpenShiftObject = context.getParent();
            odo.executeInTerminal(`odo project set ${project.getName()}; odo app describe ${context.getName()}`, process.cwd());
        };

        export const del = async function deleteApplication(cli: cli.ICli, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject) {
            let project: odoctl.OpenShiftObject = context.getParent();
            const value = await vscode.window.showWarningMessage(`Are you sure you want to delete application '${context.getName()}\'`, 'Yes', 'Cancel');
            if(value === 'Yes') {
                cli.execute(`odo project set ${project.getName()}`, {}).then(()=>{
                    cli.execute(`odo app delete ${context.getName()} -f`, {}).then((value:CliExitData)=>{
                        if(value.error) {
                            vscode.window.showErrorMessage(`Failed to delete application!`);
                        } else {
                            explorer.refresh();
                        }
                    }).catch(err=>{
                        vscode.window.showErrorMessage(`Failed to delete application with error '${err}'`);
                    });
                });
            }
        };
    }

    export namespace Service {
        export const create = async function createService(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject)  {
            const serviceTemplateNames: string[] = await odo.getServiceTemplates();
            const serviceTemplateName = await vscode.window.showQuickPick(serviceTemplateNames, {
                placeHolder: "Service Template Name"
            });
            const serviceName = await vscode.window.showInputBox({
                value: serviceTemplateName,
                prompt: 'Service Name',
                validateInput: (value:string) => {
                    // required, because dc name is ${component}-${app}
                    if (`${value.trim()}-${context.getName()}`.length > 63) {
                        return 'Service name cannot be more that 63 characters';
                    }
                    return null;
                }
            });
            await odo.execute(`odo project set ${context.getParent().getName()}`);
            await odo.execute(`odo app set ${context.getName()}`);
            await odo.execute(`odo service create ${serviceTemplateName} ${serviceName.trim()}`);
            explorer.refresh();
        };
        export const del = async function deleteService(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer, service: odoctl.OpenShiftObject, ) {
            const value = await vscode.window.showWarningMessage(`Are you sure you want to delete service '${service.getName()}'`, 'Yes', 'Cancel');
            if(value === 'Yes') {
                await odo.execute(`odo project set ${service.getParent().getParent().getName()}`);
                await odo.execute(`odo app set ${service.getParent().getName()}`);
                await odo.execute(`odo service delete ${service.getName()} -f`);
                explorer.refresh();
            }
        };
    }

    export namespace Component {
        export const createLocal = async function createLocalComponent(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            try {
                const folder = await vscode.window.showWorkspaceFolderPick({
                    placeHolder:'Select the target workspace folder'
                });

                if (!folder) return;

                const componentName = await vscode.window.showInputBox({
                    prompt: "Component name",
                    validateInput: (value:string) => {
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

                await odo.execute(`odo project set ${context.getParent().getName()}`);
                await odo.execute(`odo app set ${context.getName()}`);
                await odo.execute(`odo create ${componentTypeName}:${componentTypeVersion} ${componentName} --local ${folder.uri.fsPath}`);
                await odo.execute(`odo push --local ${folder.uri.fsPath}`);

            } catch(e) {
                vscode.window.showErrorMessage(e);
            }
        }

        export const createGit = async function createLocalComponent(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            try {
                const repoURI = await vscode.window.showInputBox({prompt: 'Git repository URI', validateInput: 
                    (value:string) => {
                        if (value.trim().length === 0) {
                            return 'Empty Git repository URL';
                        } 
                    }
                });
                
                if (!repoURI) return;

                const componentName = await vscode.window.showInputBox({prompt: "Component name", validateInput: (value:string) => {
                    if (value.trim().length === 0) {
                        return 'Empty component name';
                    } 
                }});

                if (!componentName) return;

                const componentTypeName = await vscode.window.showQuickPick(odo.getComponentTypes(), {placeHolder: "Component type"});

                if (!componentTypeName) return;

                const componentTypeVersion = await vscode.window.showQuickPick(odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type Version"});

                if (!componentTypeVersion) return;

                const createUrl = await vscode.window.showQuickPick(['Yes', 'No'], {placeHolder: 'Do you want to clone repository to workspace?'});
                await odo.execute(`odo project set ${context.getParent().getName()}`);
                await odo.execute(`odo app set ${context.getName()}`);
                await odo.execute(`odo create ${componentTypeName}:${componentTypeVersion} ${componentName} --git ${repoURI}`);
                await vscode.commands.executeCommand('git.clone', repoURI);
            } catch(e) {
                vscode.window.showErrorMessage(e);
            }
        };

        export const create = async function createComponent(odo: odoctl.Odo, context: odoctl.OpenShiftObject)  {
            // should use QuickPickItem witj label and description
            const sourceTypes = ["git", "local"];
            const componentSource = await vscode.window.showQuickPick(sourceTypes, {
                placeHolder: "Select source type for component"
            });
            if (componentSource === 'git' ) {
                createGit(odo, context);
            } else {
                createLocal(odo, context);
            }
        };

        export const del = async function deleteComponent(cli: cli.ICli, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject) {
            let app: odoctl.OpenShiftObject = context.getParent();
            let project: odoctl.OpenShiftObject = app.getParent();
            const value = await vscode.window.showWarningMessage(`Are you sure you want to delete component '${context.getName()}\'`, 'Yes', 'Cancel');
            if(value === 'Yes') {
                cli.execute(`odo project set ${project.getName()}`, {}).then(()=>{
                    cli.execute(`odo app set ${app.getName()}`, {}).then(()=>{
                        cli.execute(`odo delete ${context.getName()} -f`, {}).then((value:CliExitData)=> {
                            if(value.error) {
                                vscode.window.showErrorMessage(`Failed to delete component!`);
                            } else {
                                explorer.refresh();
                            }
                        });
                    }).catch((err)=>{
                        vscode.window.showErrorMessage(`Failed to delete component with error '${err}'`);
                    });
                });
            }
        };

        export const describe = async function componentDescribe(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            let app: odoctl.OpenShiftObject = context.getParent();
            let project: odoctl.OpenShiftObject = app.getParent();
            odo.executeInTerminal(`odo project set ${project.getName()}; odo app set ${app.getName()}; odo describe ${context.getName()}`, process.cwd());
        };

        export const log = async function logComponent(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            let app: odoctl.OpenShiftObject = context.getParent();
            let project: odoctl.OpenShiftObject = app.getParent();
            odo.executeInTerminal(`odo project set ${project.getName()}; odo app set ${app.getName()}; odo log ${context.getName()};`, process.cwd());
        };

        export const followLog = async function followLogComponent(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            let app: odoctl.OpenShiftObject = context.getParent();
            let project: odoctl.OpenShiftObject = app.getParent();
            odo.executeInTerminal(`odo project set ${project.getName()}; odo app set ${app.getName()}; odo log ${context.getName()} -f;`, process.cwd());
        };

        export const push = async function pushCmd(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            let app: odoctl.OpenShiftObject = context.getParent();
            let project: odoctl.OpenShiftObject = app.getParent();

            odo.execute(`odo project set ${project.getName()}`).then(()=>{
                odo.execute(`odo app set ${app.getName()}`).then(()=>{
                    odo.execute(`odo component set  ${context.getName()}`).then((value:CliExitData)=> {
                        odo.execute(`odo push ${context.getName()}`).then((value:CliExitData)=> {
                            if(value.error) {
                                vscode.window.showErrorMessage(`Failed to push component!`);
                            }
                        });
                    });
                });
            }).catch((err)=>{
                vscode.window.showErrorMessage(`Failed to push component with error '${err}'`);
            });
        };

        export const watch = async function watchCmd(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            let app: odoctl.OpenShiftObject = context.getParent();
            let project: odoctl.OpenShiftObject = app.getParent();
            odo.executeInTerminal(`odo project set ${project.getName()}; odo app set ${app.getName()}; odo component set ${context.getName()}; odo watch ${context.getName()};`, process.cwd());
        };

        export const openUrl = async function OpenUrlCmd(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            const app: odoctl.OpenShiftObject = context.getParent();
            const routeCheck = await odo.execute(`oc get route`);
            if (routeCheck.stdout === ''){
                const value = await vscode.window.showInformationMessage(`No URL for component '${context.getName()}\' in application '${app.getName()}\'. Do you want to create a route and open it?`, 'Create', 'Cancel');
                if(value === 'Create'){
                    await odo.execute(`odo url create`);
                }
            }
            const hostName = await odo.execute(`oc get route -o jsonpath="{range .items[?(.metadata.labels.app\\.kubernetes\\.io/component-name=='${context.getName()}')]}{.spec.host}{end}"`);
            const checkTls = await odo.execute(`oc get route -o jsonpath="{range .items[?(.metadata.labels.app\\.kubernetes\\.io/component-name=='${context.getName()}')]}{.spec.tls.termination}{end}"`);
            const tls = checkTls ? "https://" : "http://";
            opn(`${tls}${hostName.stdout}`);
        };

        export const openshiftConsole = async function (odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            opn(context.getName());
        };
    }

    export namespace Url {
        export const create = async function createUrl(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            const app: odoctl.OpenShiftObject = context.getParent();
            const project: odoctl.OpenShiftObject = app.getParent();
            const portsResult:CliExitData = await odo.execute(`oc get service ${context.getName()}-${app.getName()} -o jsonpath="{range .spec.ports[*]}{.port}{','}{end}"`);
            let ports: string[] = portsResult.stdout.trim().split(',');
            ports = ports.slice(0,ports.length-1);
            let port: string = ports[0];
            if(ports.length > 1) {
                port = await vscode.window.showQuickPick(ports, {placeHolder: "Select port to expose"});
            }

            odo.execute(`odo project set ${project.getName()}`).then(()=>{
                odo.execute(`odo app set ${app.getName()}`).then(()=>{
                    odo.execute(`odo component set ${context.getName()}`).then((value:CliExitData)=> {
                        odo.execute(`odo url create --port ${port}`).then((value:CliExitData)=> {
                            if(value.error) {
                                vscode.window.showErrorMessage(`Failed to create URL for component '${context.getName()}'!`);
                            }
                        });
                    });
                });
            }).catch((err)=>{
                vscode.window.showErrorMessage(`Failed to create URL for component '${context.getName()}'!`);
            });
        };
    }

    export namespace Explorer {
        export const login = async function loginCluster(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer) {
            if(await odo.requireLogin()) {
                let clusterURL = await vscode.window.showInputBox({
                    ignoreFocusOut: true,
                    prompt: "Provide URL of the cluster to connect",
                    validateInput: (value:string) => {
                        if(!isURL(value)) {
                            return 'Invalid URL provided';
                        }
                    }
                });
                if(!clusterURL) { return; }
                const loginMethod = await vscode.window.showQuickPick(['Credentials', 'Token'], {placeHolder: 'Select the way to log in to the cluster.'});
                if(loginMethod === "Credentials") {
                    credentialsLogin(clusterURL, odo, explorer);
                } else {
                    tokenLogin(clusterURL, odo, explorer);
                }
            } else {
                vscode.window.showInformationMessage(`You are already logged in the cluster.`);
            }
        };

        const credentialsLogin = async function(clusterURL, odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer) {
            let username = await vscode.window.showInputBox({
                ignoreFocusOut: true,
                prompt: "Provide Username for basic authentication to the API server",
                validateInput: (value:string) => {
                    if (value.trim().length === 0) {
                        return 'Invalid Username';
                    }
                }
            });
            if (!username) { return; }
            let passwd  = await vscode.window.showInputBox({
                ignoreFocusOut: true,
                password: true,
                prompt: "Provide Password for basic authentication to the API server"
            });
            if(!passwd) { return; }
            odo.execute(`oc login ${clusterURL} -u ${username} -p ${passwd}`).then((result)=>{
                loginMessage(clusterURL, result, explorer);
            });
        };

        const tokenLogin = async function(clusterURL, odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer) {
            let ocToken  = await vscode.window.showInputBox({
                prompt: "Provide Bearer token for authentication to the API server",
                ignoreFocusOut: true
            });
            odo.execute(`oc login ${clusterURL} --token=${ocToken}`).then((result)=>{
                loginMessage(clusterURL, result, explorer);
            });
        };

        const loginMessage = async function(clusterURL, result, explorer) {
            if(result.stderr === "") {
                explorer.refresh();
                vscode.window.showInformationMessage(`Successfully logged in to '${clusterURL}'`);
            } else {
                vscode.window.showErrorMessage(`Failed to login to cluster '${clusterURL}' with '${result.stderr}'!`);
            }
        };

        export const logout = async function logout(odo: odoctl.Odo, explorer: explorerFactory.OpenShiftExplorer) {
            const value = await vscode.window.showWarningMessage(`Are you sure you want to logout of cluster`, 'Logout', 'Cancel');
            if(value === 'Logout') {
                odo.execute(`oc logout`).then(async result =>{
                    if(result.stderr === "") {
                        explorer.refresh();
                        const logoutInfo = await vscode.window.showInformationMessage(`Successfully logged out. Do you want to login to a new cluster`, 'Yes', 'Cancel');
                        if(logoutInfo === 'Yes') {
                            login(odo, explorer);
                        }
                    } else {
                        vscode.window.showErrorMessage(`Failed to logout of the current cluster with '${result.stderr}'!`);
                    }
                });
            }
        };

        export const refresh = function refresh(explorer:explorerFactory.OpenShiftExplorer) {
            explorer.refresh();
        };
    }

    export namespace Storage {
        export const create = async function createStorage(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            let app: odoctl.OpenShiftObject = context.getParent();
            let project: odoctl.OpenShiftObject = app.getParent();
            const storageName = await vscode.window.showInputBox({prompt: "Specify the storage name", validateInput: (value:string) => {
                if (value.trim().length === 0) {
                    return 'Invalid storage name';
                } 
            }});
            if(!storageName) { return; } 

            const mountPath = await vscode.window.showInputBox({prompt: "Specify the mount path", validateInput: (value:string) => {
                if (value.trim().length === 0) {
                    return 'Invalid mount path';
                } 
            }});
            if(!mountPath) { return; }

            const storageSize = await vscode.window.showQuickPick(['1Gi', '1.5Gi', '2Gi'], {placeHolder: 'Select the storage size'});
            odo.executeInTerminal(`odo project set ${project.getName()}; odo app set ${app.getName()}; odo component set ${context.getName()}; odo storage create ${storageName} --path=${mountPath} --size=${storageSize};`, process.cwd());
        };

    }
}

export function activate(context: vscode.ExtensionContext) {
    const cliExec: cli.ICli = cli.create();
    const odoCli: odoctl.Odo = odoctl.create(cliExec);
    const explorer:explorerFactory.OpenShiftExplorer = explorerFactory.create(odoCli);
    let disposable = [ 
        vscode.commands.registerCommand('openshift.about', Openshift.about.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.explorer.login', Openshift.Explorer.login.bind(undefined, odoCli, explorer)),
        vscode.commands.registerCommand('openshift.explorer.logout', Openshift.Explorer.logout.bind(undefined, odoCli, explorer)),
        vscode.commands.registerCommand('openshift.explorer.refresh', Openshift.Explorer.refresh.bind(undefined, explorer)),
        vscode.commands.registerCommand('openshift.catalog.list.components', Openshift.Catalog.listComponents.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.catalog.list.services', Openshift.Catalog.listServices.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.project.create', Openshift.Project.create.bind(undefined, cliExec, explorer)),
        vscode.commands.registerCommand('openshift.project.delete', Openshift.Project.del.bind(undefined, cliExec, explorer)),
        vscode.commands.registerCommand('openshift.app.describe', Openshift.Application.describe.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.app.create', Openshift.Application.create.bind(undefined, cliExec, explorer)),
        vscode.commands.registerCommand('openshift.app.delete', Openshift.Application.del.bind(undefined, cliExec, explorer)),
        vscode.commands.registerCommand('openshift.component.describe', Openshift.Component.describe.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.create', Openshift.Component.create.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.push', Openshift.Component.push.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.watch', Openshift.Component.watch.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.log', Openshift.Component.log.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.followLog', Openshift.Component.followLog.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.openUrl', Openshift.Component.openUrl.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.openshiftConsole', Openshift.Component.openshiftConsole.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.delete', Openshift.Component.del.bind(undefined, cliExec, explorer)),
        vscode.commands.registerCommand('openshift.storage.create', Openshift.Storage.create.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.url.create', Openshift.Url.create.bind(undefined,cliExec)),
        vscode.commands.registerCommand('openshift.service.create', Openshift.Service.create.bind(undefined,odoCli, explorer)),
        vscode.commands.registerCommand('openshift.service.delete', Openshift.Service.del.bind(undefined,odoCli, explorer)),
        vscode.window.registerTreeDataProvider('openshiftProjectExplorer', explorer),
        explorer
    ];
    disposable.forEach(value=>context.subscriptions.push(value));
}

// this method is called when your extension is deactivated
export function deactivate() {
}