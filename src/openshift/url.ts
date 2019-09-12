/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftObject, Command } from '../odo';
import { window, QuickPickItem } from 'vscode';
import { V1ServicePort } from '@kubernetes/client-node';
import { OpenShiftItem } from './openshiftItem';
import { Progress } from "../util/progress";
import open = require('open');
import { ChildProcess } from 'child_process';

export class Url extends OpenShiftItem{

    static async create(context: OpenShiftObject): Promise<string> {
        const component = await Url.getOpenShiftCmdData(context,
            'Select a Project to create a URL',
            'Select an Application to create a URL',
            'Select a Component you want to create a URL for');
        if (component) {
            const urlName = await Url.getName('URL name', await Url.odo.getRoutes(component));
            if (!urlName) return null;
            const ports: V1ServicePort[] = await Url.odo.getComponentPorts(component);
            const portItems: QuickPickItem[] = ports.map((item: any) => {
                item['label'] = `${item.port}/${item.protocol}`;
                return item;
            });
            let port: V1ServicePort | QuickPickItem;
            if (ports.length === 1) {
                port = ports[0];
            } else if (ports.length > 1) {
                port = await window.showQuickPick(portItems, {placeHolder: "Select port to expose"});
            } else {
                return Promise.reject(`Component '${component.getName()}' has no ports declared.`);
            }

            if (port) {
                return Progress.execFunctionWithProgress(`Creating a URL '${urlName}' for the Component '${component.getName()}'`,
                    () => Url.odo.createComponentCustomUrl(component, `${urlName}`, `${port['port']}`)
                        .then(() => `URL '${urlName}' for component '${component.getName()}' successfully created`)
                        .catch((err) => Promise.reject(`Failed to create URL '${urlName}' for component '${component.getName()}'. ${err.message}`))
                );
            }
        }
        return null;
    }

    static async del(treeItem: OpenShiftObject): Promise<string> {
        let url = treeItem;
        const component = await Url.getOpenShiftCmdData(url,
            "From which Project you want to delete URL",
            "From which Application you want to delete URL",
            "From which Component you want to delete URL");
        if (!url && component) {
            url = await window.showQuickPick(Url.odo.getRoutes(component), {placeHolder: `Select the URL to delete from the component ${component.getName()}`});
        }
        if (url) {
            const value = await window.showWarningMessage(`Do you want to delete URL '${url.getName()}' from Component '${url.getParent().getName()}'?`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                return Progress.execFunctionWithProgress(`Deleting URL ${url.getName()} from Component ${component.getName()}`, () => Url.odo.deleteURL(url))
                    .then(() => `URL '${url.getName()}' from Component '${url.getParent().getName()}' successfully deleted`)
                    .catch((err) => Promise.reject(`Failed to delete URL with error '${err}'`));
            }
        }
        return null;
    }

    static async open(treeItem: OpenShiftObject): Promise<ChildProcess> {
        const component = treeItem.getParent();
        const app = component.getParent();
        const namespace = app.getParent();
        const urlDetails = await Url.odo.execute(Command.getComponentUrl(namespace.getName(), app.getName(), component.getName()), component.contextPath.fsPath);
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
        if (urlObject) {
            open(`${urlObject[0].spec.protocol}://${urlObject[0].spec.host}`);
        } else {
            window.showInformationMessage('Selected URL is not created in cluster. Use \'Push\' command before opening URL in browser.');
        }
        return null;
    }
}