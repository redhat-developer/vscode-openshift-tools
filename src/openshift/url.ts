/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window, QuickPickItem, commands, Uri } from 'vscode';
import { OpenShiftObject } from '../odo';
import { Command } from '../odo/command';
import OpenShiftItem from './openshiftItem';
import { Progress } from '../util/progress';
import { Port } from '../odo/config';
import { vsCommand, VsCommandError } from '../vscommand';
import { ComponentKind } from '../odo/componentType';
import { Url as OdoUrl } from '../odo/url';

export class Url extends OpenShiftItem{

    @vsCommand('openshift.url.create')
    static async create(context: OpenShiftObject): Promise<string> {
        const component:OpenShiftObject = await Url.getOpenShiftCmdData(context,
            'Select an Application to create a URL',
            'Select a Component you want to create a URL for');
        if (component) {
            const urlName = await Url.getName('URL name', Url.odo.getRoutes(component));
            if (!urlName) return null;

            let port: string;
            if (component.kind === ComponentKind.S2I) {
                const ports: Port[] = await Url.odo.getComponentPorts(component);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const portItems: QuickPickItem[] = ports.map<QuickPickItem>((item: any) => {
                    item.label = `${item.number}/${item.protocol}`;
                    return item;
                });
                if (ports.length === 1) {
                    port = ports[0].number.toString();
                } else if (ports.length > 1) {
                    const selectedPort = await window.showQuickPick(portItems, {placeHolder: 'Select port to expose'});
                    port = selectedPort ? (selectedPort as unknown as Port).number.toString() : undefined;
                } else {
                    throw new VsCommandError(`Component '${component.getName()}' has no ports declared.`);
                }
            } else {
                port = await window.showInputBox({
                    placeHolder: 'Enter port number (1024 .. 65535)',
                    ignoreFocusOut: true,
                    validateInput: (enteredPort): string => {
                        let message: string | undefined;
                        let enteredPortNumber: number | undefined;
                        if (enteredPort.length > 0) {
                            if (!new RegExp(/\D+/).test(enteredPort.trim())) {
                                enteredPortNumber = Number.parseInt(enteredPort, 10);
                            }
                            if (!enteredPortNumber) {
                                message = 'Entered port is not a number';
                            } else if (enteredPortNumber < 1024 || enteredPortNumber > 65535) {
                                message = 'Entered port number is out of range';
                            }
                        } else {
                            message = 'Please enter port number';
                        }
                        return message;
                    }
                });
            }
            if (!port) return null;
            const parsedNumber = Number.parseInt(port, 10);
            const secure = await window.showQuickPick(['Yes', 'No'], {placeHolder: 'Do you want to secure new URL?'});
            if (secure) {
                return Progress.execFunctionWithProgress(`Creating a URL '${urlName}' for the Component '${component.getName()}'`,
                    () => Url.odo.createComponentCustomUrl(component, `${urlName}`, `${parsedNumber}`, secure === 'Yes')
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
            'From which Application you want to delete URL',
            'From which Component you want to delete URL');
        if (!url && component) {
            url = await window.showQuickPick(Url.odo.getRoutes(component), {placeHolder: `Select the URL to delete from the component ${component.getName()}`, ignoreFocusOut: true});
        }
        if (url) {
            const value = await window.showWarningMessage(`Do you want to delete URL '${url.getName()}' from Component '${url.getParent().getName()}'?`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                return Progress.execFunctionWithProgress(`Deleting URL ${url.getName()} from Component ${url.getParent().getName()}`, () => Url.odo.deleteURL(url))
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
        let urlObject: OdoUrl[];
        let result: OdoUrl[];
        try {
            result = JSON.parse(urlDetails.stdout).items;
        } catch (ignore) {
            // in case of incorrect json output, ignore an error
        }
        if (result && result.length > 0) {
            urlObject = result.filter((value) => (value.metadata.name === treeItem.getName() || value.metadata.name === treeItem.getName().replace('/', '-')));
        }
        if (urlObject[0].status.state === 'Pushed') {
            await commands.executeCommand('vscode.open', Uri.parse(`${urlObject[0].spec.protocol}://${urlObject[0].spec.host}`));
        } else {
            return 'Selected URL is not created in cluster yet. Use \'Push\' command before opening URL in browser.';
        }
    }

    @vsCommand('openshift.url.describe', true)
    static async describe(treeItem: OpenShiftObject): Promise<void> {
        let url = treeItem;
        const component = await Url.getOpenShiftCmdData(url,
            'From which Application you want to describe URL',
            'From which Component you want to describe URL');
        if (!url && component) {
            url = await window.showQuickPick(Url.odo.getRoutes(component), {placeHolder: `Select the URL to describe from the component ${component.getName()}`, ignoreFocusOut: true});
        }
        if (url) Url.odo.executeInTerminal(Command.describeUrl(url.getName()), url.getParent().contextPath.fsPath, `OpenShift: Describe '${url.getName()} URL`);
    }
}
