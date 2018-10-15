/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

 'use strict';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as explorerFactory from './explorer';
import * as cli from './cli';
import * as odoctl from './odo';
import { Openshift } from './command';

export function activate(context: vscode.ExtensionContext) {
    const cliExec: cli.ICli = cli.create();
    const odoCli: odoctl.Odo = odoctl.create(cliExec);
    const explorer: explorerFactory.OpenShiftExplorer = explorerFactory.create(odoCli);
    const disposable = [
        vscode.commands.registerCommand('openshift.about', Openshift.about.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.explorer.login', Openshift.Explorer.login.bind(undefined, odoCli, explorer)),
        vscode.commands.registerCommand('openshift.explorer.logout', Openshift.Explorer.logout.bind(undefined, odoCli, explorer)),
        vscode.commands.registerCommand('openshift.explorer.refresh', Openshift.Explorer.refresh.bind(undefined, explorer)),
        vscode.commands.registerCommand('openshift.catalog.list.components', Openshift.Catalog.listComponents.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.catalog.list.services', Openshift.Catalog.listServices.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.project.create', Openshift.Project.create.bind(undefined, odoCli, explorer)),
        vscode.commands.registerCommand('openshift.project.delete', Openshift.Project.del.bind(undefined, odoCli, explorer)),
        vscode.commands.registerCommand('openshift.app.describe', Openshift.Application.describe.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.app.create', Openshift.Application.create.bind(undefined, odoCli, explorer)),
        vscode.commands.registerCommand('openshift.app.delete', Openshift.Application.del.bind(undefined, odoCli, explorer)),
        vscode.commands.registerCommand('openshift.component.describe', Openshift.Component.describe.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.create', Openshift.Component.create.bind(undefined, odoCli, explorer)),
        vscode.commands.registerCommand('openshift.component.push', Openshift.Component.push.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.watch', Openshift.Component.watch.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.log', Openshift.Component.log.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.followLog', Openshift.Component.followLog.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.openUrl', Openshift.Component.openUrl.bind(undefined, odoCli)),
        vscode.commands.registerCommand('openshift.component.openshiftConsole', Openshift.Component.openshiftConsole.bind(undefined)),
        vscode.commands.registerCommand('openshift.component.delete', Openshift.Component.del.bind(undefined, odoCli, explorer)),
        vscode.commands.registerCommand('openshift.storage.create', Openshift.Storage.create.bind(undefined, odoCli, explorer)),
        vscode.commands.registerCommand('openshift.storage.delete', Openshift.Storage.del.bind(undefined, odoCli, explorer)),
        vscode.commands.registerCommand('openshift.url.create', Openshift.Url.create.bind(undefined, cliExec)),
        vscode.commands.registerCommand('openshift.service.create', Openshift.Service.create.bind(undefined, odoCli, explorer)),
        vscode.commands.registerCommand('openshift.service.delete', Openshift.Service.del.bind(undefined, odoCli, explorer)),
        vscode.window.registerTreeDataProvider('openshiftProjectExplorer', explorer),
        explorer
    ];
    disposable.forEach((value)=> context.subscriptions.push(value));
}

// this method is called when your extension is deactivated
export function deactivate() {
}