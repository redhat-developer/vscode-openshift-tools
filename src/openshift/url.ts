/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window, QuickPickItem, commands, Uri } from 'vscode';
import { OpenShiftObject, Command } from '../odo';
import OpenShiftItem from './openshiftItem';
import { Progress } from "../util/progress";
import { Port } from '../odo/config';
import { vsCommand, VsCommandError } from '../vscommand';

export class Url extends OpenShiftItem{

    @vsCommand('openshift.url.create')
    static async create(context: OpenShiftObject): Promise<string> {
        const component = await Url.getOpenShiftCmdData(context,
            'Select a Project to create a URL',
            'Select an Application to create a URL',
            'Select a Component you want to create a URL for');
        if (component) {
            const urlName = await Url.getName('URL name', await Url.odo.getRoutes(component));
            if (!urlName) return null;
            const ports: Port[] = await Url.odo.getComponentPorts(component);
            const portItems: QuickPickItem[] = ports.map<QuickPickItem>((item: any) => {
                item.label = `${item.Number}/${item.Protocol}`;
                return item;
            });
            let port: Port | QuickPickItem;
            if (ports.length === 1) {
                [ port ] = ports;
            } else if (ports.length > 1) {
                port = await window.showQuickPick(portItems, {placeHolder: "Select port to expose"});
            } else {
                throw new VsCommandError(`Component '${component.getName()}' has no ports declared.`);
            }
            if (!port) return null;
            const secure = await window.showQuickPick(['Yes', 'No'], {placeHolder: "Do you want to secure new URL?"});
            if (secure) {
                return Progress.execFunctionWithProgress(`Creating a URL '${urlName}' for the Component '${component.getName()}'`,
                    () => Url.odo.createComponentCustomUrl(component, `${urlName}`, `${(port as any).Number}`, secure === 'Yes')
                        .then(() => `URL '${urlName}' for component '${component.getName()}' successfully created`)
                        .catch((err) => Promise.reject(new VsCommandError(`Failed to create URL '${urlName}' for component '${component.getName()}'. ${err.message}`)))
                );
            }
        }
        return null;
    }

    @vsCommand('openshift.url.delete', true)
    static async del(treeItem: OpenShiftObject): Promise<string | null> {
        let url = treeItem;
        const component = await Url.getOpenShiftCmdData(url,
            "From which Project you want to delete URL",
            "From which Application you want to delete URL",
            "From which Component you want to delete URL");
        if (!url && component) {
            url = await window.showQuickPick(Url.odo.getRoutes(component), {placeHolder: `Select the URL to delete from the component ${component.getName()}`, ignoreFocusOut: true});
        }
        if (url) {
            const value = await window.showWarningMessage(`Do you want to delete URL '${url.getName()}' from Component '${url.getParent().getName()}'?`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                return Progress.execFunctionWithProgress(`Deleting URL ${url.getName()} from Component ${component.getName()}`, () => Url.odo.deleteURL(url))
                    .then(() => `URL '${url.getName()}' from Component '${url.getParent().getName()}' successfully deleted`)
                    .catch((err) => Promise.reject(new VsCommandError(`Failed to delete URL with error '${err}'`)));
            }
        }
        return null;
    }

    @vsCommand('openshift.url.open')
    static async open(treeItem: OpenShiftObject): Promise<string> {
        const component = treeItem.getParent();
        const urlDetails = await Url.odo.execute(Command.getComponentUrl(), component.contextPath.fsPath);
        let urlObject: any;
        let result: any[];
        try {
            result = JSON.parse(urlDetails.stdout).items;
        } catch (ignore) {
            // in case of incorrect json output, ignore an error
        }
        if (result && result.length > 0) {
            urlObject = result.filter((value) => (value.metadata.name === treeItem.getName()));
        }
        if (urlObject[0].status.state === 'Pushed') {
            commands.executeCommand('vscode.open', Uri.parse(`${urlObject[0].spec.protocol}://${urlObject[0].spec.host}`));
        } else {
            return 'Selected URL is not created in cluster. Use \'Push\' command before opening URL in browser.';
        }
    }

    @vsCommand('openshift.url.describe', true)
    static async describe(treeItem: OpenShiftObject): Promise<void> {
        let url = treeItem;
        const component = await Url.getOpenShiftCmdData(url,
            "From which Project you want to describe URL",
            "From which Application you want to describe URL",
            "From which Component you want to describe URL");
        if (!url && component) {
            url = await window.showQuickPick(Url.odo.getRoutes(component), {placeHolder: `Select the URL to describe from the component ${component.getName()}`, ignoreFocusOut: true});
        }
        if (url) Url.odo.executeInTerminal(Command.describeUrl(url.getName()));
    }
}
