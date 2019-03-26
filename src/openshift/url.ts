/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftObject, Command } from '../odo';
import { window, QuickPickItem } from 'vscode';
import { Component } from '../openshift/component';
import { V1ServicePort } from '@kubernetes/client-node';
import { OpenShiftItem } from './openshiftItem';

export class Url extends OpenShiftItem{

    static async create(context: OpenShiftObject): Promise<string> {
        const component = await Url.getOpenShiftCmdData(context,
            'Select a Project to create Url',
            'Select an Application to create Url',
            'Select a Component you want to create Url for');
        if (component) {
            const app: OpenShiftObject = component.getParent();
            const project: OpenShiftObject = app.getParent();
            const urlName = await window.showInputBox({
                prompt: `Specify custom url name for component ${component.getName()}`,
                validateInput: (value: string) => {
                    if (!value.trim()) return 'Empty url name';
                }
            });
            if (!urlName) return null;
            const ports: V1ServicePort[] = await Component.getComponentPorts(component);
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
            return port === undefined ? undefined : Promise.resolve()
                .then(async () => Url.odo.execute(Command.createComponentCustomUrl(project.getName(), app.getName(), component.getName(), `${urlName}`, `${port['port']}`)))
                .then(() => `URL '${urlName}' for component '${component.getName()}' successfully created`)
                .catch((err) => Promise.reject(`Failed to create URL '${urlName}' for component '${component.getName()}'. ${err.message}`));
        }
        return null;
    }
}