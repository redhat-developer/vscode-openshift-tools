/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { OpenShiftExplorer } from './explorer';
import { Cluster } from './openshift/cluster';
import { Catalog } from './openshift/catalog';
import { Project } from './openshift/project';
import { Application } from './openshift/application';
import { Component } from './openshift/component';
import { Storage } from './openshift/storage';
import { Url } from './openshift/url';
import { Service } from './openshift/service';
import { Platform } from './util/platform';
import path = require('path');
import fsx = require('fs-extra');

export let contextGlobalState: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
    contextGlobalState = context;
    migrateFromOdo018();

    const disposable = [
        vscode.commands.registerCommand('openshift.about', (context) => execute(Cluster.about, context)),
        vscode.commands.registerCommand('openshift.output', (context) => execute(Cluster.showOpenShiftOutput, context)),
        vscode.commands.registerCommand('openshift.openshiftConsole', (context) => execute(Cluster.openshiftConsole, context)),
        vscode.commands.registerCommand('openshift.openshiftConsole.palette', (context) => execute(Cluster.openshiftConsole, context)),
        vscode.commands.registerCommand('openshift.explorer.login', (context) => execute(Cluster.login, context)),
        vscode.commands.registerCommand('openshift.explorer.login.tokenLogin', (context) => execute(Cluster.tokenLogin, context)),
        vscode.commands.registerCommand('openshift.explorer.login.credentialsLogin', (context) => execute(Cluster.credentialsLogin, context)),
        vscode.commands.registerCommand('openshift.explorer.logout', (context) => execute(Cluster.logout, context)),
        vscode.commands.registerCommand('openshift.explorer.refresh', (context) => execute(Cluster.refresh, context)),
        vscode.commands.registerCommand('openshift.catalog.listComponents', (context) => execute(Catalog.listComponents, context)),
        vscode.commands.registerCommand('openshift.catalog.listServices', (context) => execute(Catalog.listServices, context)),
        vscode.commands.registerCommand('openshift.project.create', (context) => execute(Project.create, context)),
        vscode.commands.registerCommand('openshift.project.delete', (context) => execute(Project.del, context)),
        vscode.commands.registerCommand('openshift.project.delete.palette', (context) => execute(Project.del, context)),
        vscode.commands.registerCommand('openshift.app.delete.palette', (context) => execute(Application.del, context)),
        vscode.commands.registerCommand('openshift.app.describe', (context) => execute(Application.describe, context)),
        vscode.commands.registerCommand('openshift.app.describe.palette', (context) => execute(Application.describe, context)),
        vscode.commands.registerCommand('openshift.app.create', (context) => execute(Application.create, context)),
        vscode.commands.registerCommand('openshift.app.delete', (context) => execute(Application.del, context)),
        vscode.commands.registerCommand('openshift.component.describe', (context) => execute(Component.describe, context)),
        vscode.commands.registerCommand('openshift.component.describe.palette', (context) => execute(Component.describe, context)),
        vscode.commands.registerCommand('openshift.component.folder.create', (context) => execute(Component.createFromFolder, context)),
        vscode.commands.registerCommand('openshift.component.create', (context) => execute(Component.create, context)),
        vscode.commands.registerCommand('openshift.component.create.local', (context) => execute(Component.createFromLocal, context)),
        vscode.commands.registerCommand('openshift.component.create.git', (context) => execute(Component.createFromGit, context)),
        vscode.commands.registerCommand('openshift.component.create.binary', (context) => execute(Component.createFromBinary, context)),
        vscode.commands.registerCommand('openshift.component.delete.palette', (context) => execute(Component.del, context)),
        vscode.commands.registerCommand('openshift.component.push', (context) => execute(Component.push, context)),
        vscode.commands.registerCommand('openshift.component.push.palette', (context) => execute(Component.push, context)),
        vscode.commands.registerCommand('openshift.component.watch', (context) => execute(Component.watch, context)),
        vscode.commands.registerCommand('openshift.component.watch.palette', (context) => execute(Component.watch, context)),
        vscode.commands.registerCommand('openshift.component.log', (context) => execute(Component.log, context)),
        vscode.commands.registerCommand('openshift.component.log.palette', (context) => execute(Component.log, context)),
        vscode.commands.registerCommand('openshift.component.followLog', (context) => execute(Component.followLog, context)),
        vscode.commands.registerCommand('openshift.component.followLog.palette', (context) => execute(Component.followLog, context)),
        vscode.commands.registerCommand('openshift.component.openUrl', (context) => execute(Component.openUrl, context)),
        vscode.commands.registerCommand('openshift.component.openUrl.palette', (context) => execute(Component.openUrl, context)),
        vscode.commands.registerCommand('openshift.component.delete', (context) => execute(Component.del, context)),
        vscode.commands.registerCommand('openshift.storage.create', (context) => execute(Storage.create, context)),
        vscode.commands.registerCommand('openshift.storage.delete.palette', (context) => execute(Storage.del, context)),
        vscode.commands.registerCommand('openshift.storage.delete', (context) => execute(Storage.del, context)),
        vscode.commands.registerCommand('openshift.url.create', (context) => execute(Url.create, context)),
        vscode.commands.registerCommand('openshift.service.create', (context) => execute(Service.create, context)),
        vscode.commands.registerCommand('openshift.service.delete', (context) => execute(Service.del, context)),
        vscode.commands.registerCommand('openshift.service.delete.palette', (context) => execute(Service.del, context)),
        vscode.commands.registerCommand('openshift.service.describe', (context) => execute(Service.describe, context)),
        vscode.commands.registerCommand('openshift.service.describe.palette', (context) => execute(Service.describe, context)),
        vscode.commands.registerCommand('openshift.component.linkComponent', (context) => execute(Component.linkComponent, context)),
        vscode.commands.registerCommand('openshift.component.linkService', (context) => execute(Component.linkService, context)),
        OpenShiftExplorer.getInstance()
    ];
    disposable.forEach((value)=> context.subscriptions.push(value));
}

// this method is called when your extension is deactivated
export function deactivate() {
}

function execute<T>(command: (...args: T[]) => Promise<any> | void, ...params: T[]) {
    try {
        const res = command.call(null, ...params);
        return res && res.then
            ? res.then((result: any) => {
                displayResult(result);

            }).catch((err: any) => {
                vscode.window.showErrorMessage(err.message ? err.message : err);
            })
            : undefined;
    } catch (err) {
        vscode.window.showErrorMessage(err);
    }
}

function displayResult(result?: any) {
    if (result && typeof result === 'string') {
        vscode.window.showInformationMessage(result);
    }
}

function migrateFromOdo018 () {
    const newCfgDir = path.join(Platform.getUserHomePath(), '.odo');
    const newCfg = path.join(newCfgDir, 'odo-config.yaml');
    const oldCfg = path.join(Platform.getUserHomePath(), '.kube', 'odo');
    if (!fsx.existsSync(newCfg) && fsx.existsSync(oldCfg)) {
        fsx.ensureDirSync(newCfgDir);
        fsx.copyFileSync(oldCfg, newCfg);
    }
}