'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as explorerFactory from './explorer';
import * as cli from './cli';
import * as odoctl from './odo';
import { CliExitData } from './cli';
import * as git from './git';
import * as path from 'path';

export namespace Openshift {
    export namespace Catalog {
        export const list = function listComponentTypes(odo: odoctl.Odo) {
            odo.executeInTerminal(`odo catalog list`, 'c:\\');            
        };
    }
    export namespace Project {
        export const create = async function createProjectCmd(cli: cli.ICli, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject) {
            const value  = await vscode.window.showInputBox({prompt: "Project name"});
            await cli.execute(`odo project create ${value.trim()}`, {});
            await explorer.refresh();
        };
        export const del = function deleteProjectCmd(context) {
            vscode.window.showInformationMessage('Delete project is not implemented yet!');
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
            odo.executeInTerminal(`odo project set ${project.getName()}; odo app describe ${context.getName()}`, 'c:\\');
        };
        export const del = async function deleteApplication(cli: cli.ICli, explorer: explorerFactory.OpenShiftExplorer, context: odoctl.OpenShiftObject) {
            let project: odoctl.OpenShiftObject = context.getParent();
            const value = await vscode.window.showWarningMessage(`Are you sure you want to delete application '${context.getName()}\'`, 'Yes', 'Cancel');
            if(value === 'Yes') {
                cli.execute(`odo project set ${project.getName()}`, {}).then(()=>{
                    cli.execute(`odo app delete ${context.getName()} -f`, {}).then((value:CliExitData)=>{
                        if(value.code) {
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
    export namespace Component {
        export const create = async function createComponent(odo: odoctl.Odo, context: odoctl.OpenShiftObject)  {
            try {
                const repoURI = await vscode.window.showInputBox({prompt: 'Git repository URI', validateInput: 
                    (value:string) => {
                        if (value.trim().length === 0) {
                            return 'Empty Git repository URL';
                        } 
                    }
                });
                
                if (!repoURI) { return; }

                const componentName = await vscode.window.showInputBox({prompt: "Component name", validateInput: (value:string) => {
                    if (value.trim().length === 0) {
                        return 'Empty component name';
                    } 
                }});

                if (!componentName) { return; }

                const componentTypeNames:string[] = await odo.getComponentTypes();
                const componentTypeName = await vscode.window.showQuickPick(componentTypeNames, {placeHolder: "Component type"});

                if (!componentTypeName) { return; }

                const versions: string[] = await odo.getComponentTypeVersions(componentTypeName);
                const componentTypeVersion = await vscode.window.showQuickPick(versions, {placeHolder: "Component type Version"});

                if (!componentTypeVersion) { return; }

                const createUrl = await vscode.window.showQuickPick(['Yes', 'No'], {placeHolder: 'Do you want to create route?'});
                const pathHint = vscode.workspace.getConfiguration('git').get<string>('path');
                const info = await git.findGit(pathHint, path => console.log(path));
                const gitCli = new git.Git({ gitPath: info.path, version: info.version });
                let repoLocation = await gitCli.clone(repoURI, vscode.workspace.rootPath, componentName);
                repoLocation = repoLocation.replace('c:','').replace(/\\/g,'/');
                const currentProject = context.getParent().getName();
                await odo.execute(`odo project set ${currentProject}`);
                await odo.execute(`odo app set ${context.getName()}`);
                await odo.execute(`odo create ${componentTypeName}:${componentTypeVersion} ${componentName} --local ${repoLocation}`);
                if( createUrl === 'Yes') {
                    await odo.execute('odo url create'); 
                }
                await odo.execute(`odo push --local ${repoLocation}`);
            }  catch(e) {
                console.log(e);
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
                            if(value.code) {
                                vscode.window.showErrorMessage(`Failed to delete component!`);
                            } else {
                                explorer.refresh();
                            }
                        });
                    }).catch((err)=>{
                        vscode.window.showErrorMessage(`Failed to delete application with error '${err}'`);
                    });
                });
            }
        };
        export const describe = async function componentDescribe(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            let app: odoctl.OpenShiftObject = context.getParent();
            let project: odoctl.OpenShiftObject = app.getParent();
            odo.executeInTerminal(`odo project set ${project.getName()}; odo app set ${app.getName()}; odo describe ${context.getName()}`, 'c:\\');
        };
        export const log = async function logComponent(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            let app: odoctl.OpenShiftObject = context.getParent();
            let project: odoctl.OpenShiftObject = app.getParent();
            odo.executeInTerminal(`odo project set ${project.getName()}; odo app set ${app.getName()}; odo log ${context.getName()};`, 'c:\\Temp');
        };
        export const push = async function pushCmd(odo: odoctl.Odo, context: odoctl.OpenShiftObject) {
            let app: odoctl.OpenShiftObject = context.getParent();
            let project: odoctl.OpenShiftObject = app.getParent();

            odo.execute(`odo project set ${project.getName()}`).then(()=>{
                odo.execute(`odo app set ${app.getName()}`).then(()=>{
                    odo.execute(`odo component set  ${context.getName()}`).then((value:CliExitData)=> {
                        odo.execute(`odo push ${context.getName()}`).then((value:CliExitData)=> {
                            if(value.code) {
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
            odo.executeInTerminal(`odo project set ${project.getName()}; odo app set ${app.getName()}; odo component set ${context.getName()}; odo watch ${context.getName()};`, 'c:\\');
        };
    }
    export namespace Url {
        export const create = function createUrl(context) {
            vscode.window.showInformationMessage('odo url create');
        };
    }
    export namespace Explorer {
        export const refresh = function refresh(explorer:explorerFactory.OpenShiftExplorer) {
            explorer.refresh();
        };
    }
}

export function activate(context: vscode.ExtensionContext) {
    const cliExec: cli.ICli = cli.create();
    const odoCli: odoctl.Odo = odoctl.create(cliExec);
    const explorer:explorerFactory.OpenShiftExplorer = explorerFactory.create(odoCli);
    let disposable = [ 
        vscode.commands.registerCommand('openshift.explorer.refresh', Openshift.Explorer.refresh.bind(undefined, explorer)),
        vscode.commands.registerCommand('openshift.catalog.list', Openshift.Catalog.list.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.project.create', Openshift.Project.create.bind(undefined, cliExec, explorer)),
        vscode.commands.registerCommand('openshift.project.delete', Openshift.Project.del),
        vscode.commands.registerCommand('openshift.app.describe', Openshift.Application.describe.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.app.create', Openshift.Application.create.bind(undefined, cliExec, explorer)),
        vscode.commands.registerCommand('openshift.app.delete', Openshift.Application.del.bind(undefined, cliExec, explorer)),
        vscode.commands.registerCommand('openshift.component.describe', Openshift.Component.describe.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.create', Openshift.Component.create.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.push', Openshift.Component.push.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.watch', Openshift.Component.watch.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.log', Openshift.Component.log.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.delete', Openshift.Component.del.bind(undefined, cliExec, explorer)),
        vscode.window.registerTreeDataProvider('openshiftProjectExplorer', explorer)
    ];
    disposable.forEach(value=>context.subscriptions.push(value));
}

// this method is called when your extension is deactivated
export function deactivate() {
}