/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as explorerFactory from './explorer';
import { Cluster } from './openshift/cluster';
import { Catalog } from './openshift/catalog';
import { Project } from './openshift/project';
import { Application } from './openshift/application';
import { Component } from './openshift/component';
import { Storage } from './openshift/storage';
import { Url } from './openshift/url';
import { Service } from './openshift/service';

export function activate(context: vscode.ExtensionContext) {
    const explorer: explorerFactory.OpenShiftExplorer = explorerFactory.OpenShiftExplorer.getInstance();
    const disposable = [
        vscode.commands.registerCommand('openshift.about', (context) => executeSync(Cluster.about, context)),
        vscode.commands.registerCommand('openshift.explorer.login', (context) => execute(Cluster.login, context)),
        vscode.commands.registerCommand('openshift.explorer.logout', (context) => execute(Cluster.logout, context)),
        vscode.commands.registerCommand('openshift.explorer.refresh', (context) => executeSync(Cluster.refresh, context)),
        vscode.commands.registerCommand('openshift.catalog.list.components', (context) => executeSync(Catalog.listComponents, context)),
        vscode.commands.registerCommand('openshift.catalog.list.services', (context) => executeSync(Catalog.listServices, context)),
        vscode.commands.registerCommand('openshift.project.create', (context) => execute(Project.create, context)),
        vscode.commands.registerCommand('openshift.project.delete', (context) => execute(Project.del, context)),
        vscode.commands.registerCommand('openshift.app.describe', (context) => executeSync(Application.describe, context)),
        vscode.commands.registerCommand('openshift.app.create', (context) => execute(Application.create, context)),
        vscode.commands.registerCommand('openshift.app.delete', (context) => execute(Application.del, context)),
        vscode.commands.registerCommand('openshift.component.describe', (context) => executeSync(Component.describe, context)),
        vscode.commands.registerCommand('openshift.component.create', (context) => execute(Component.create, context)),
        vscode.commands.registerCommand('openshift.component.push', (context) => execute(Component.push, context)),
        vscode.commands.registerCommand('openshift.component.watch', (context) => executeSync(Component.watch, context)),
        vscode.commands.registerCommand('openshift.component.log', (context) => executeSync(Component.log, context)),
        vscode.commands.registerCommand('openshift.component.followLog', (context) => executeSync(Component.followLog, context)),
        vscode.commands.registerCommand('openshift.component.openUrl', (context) => execute(Component.openUrl, context)),
        vscode.commands.registerCommand('openshift.component.openshiftConsole', (context) => execute(Component.openshiftConsole, context)),
        vscode.commands.registerCommand('openshift.component.delete', (context) => execute(Component.del, context)),
        vscode.commands.registerCommand('openshift.storage.create', (context) => execute(Storage.create, context)),
        vscode.commands.registerCommand('openshift.storage.delete', (context) => execute(Storage.del, context)),
        vscode.commands.registerCommand('openshift.url.create', (context) => execute(Url.create, context)),
        vscode.commands.registerCommand('openshift.service.create', (context) => execute(Service.create, context)),
        vscode.commands.registerCommand('openshift.service.delete', (context) => execute(Service.del, context)),
        vscode.window.registerTreeDataProvider('openshiftProjectExplorer', explorer),
        explorer
    ];
    disposable.forEach((value)=> context.subscriptions.push(value));
}

// this method is called when your extension is deactivated
export function deactivate() {
}

function execute<T>(command: (...args: T[]) => Promise<any>, ...params: T[]) {
    return command.call(null, ...params)
    .then((result) => {
        displayResult(result);
    }).catch((err) => {
        vscode.window.showErrorMessage(err);
    });
}

function executeSync<T>(command: (...args: T[]) => any, ...params: T[]) {
    try {
        const result = command.call(null, ...params);
        displayResult(result);
    } catch (err) {
        vscode.window.showErrorMessage(err);
    }
}

function displayResult(result?: any) {
    if (result && typeof result === 'string') {
        vscode.window.showInformationMessage(result);
    }
}