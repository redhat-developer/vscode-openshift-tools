/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Odo, OdoImpl, OpenShiftObject, ContextType, OpenShiftObjectImpl } from '../odo';
import { OpenShiftExplorer } from '../explorer';
import { window, QuickPick, QuickPickItem, TreeItemCollapsibleState } from 'vscode';
import * as validator from 'validator';

const errorMessage = {
    Project: 'You need at least one Project available. Please create new OpenShift Project and try again.',
    Application: 'You need at least one Application available. Please create new OpenShift Application and try again.',
    Component: 'You need at least one Component available. Please create new OpenShift Component and try again.',
    Service: 'You need at least one Service available. Please create new OpenShift Service and try again.',
    Storage: 'You need at least one Storage available. Please create new OpenShift Storage and try again.',
    Route: 'You need to add one URL to the component. Please create a new URL and try again.'
};

export class QuickPickCommand implements QuickPickItem {
    constructor (public label: string,
        public command: () => Promise<string>,
        public description?: string,
        public detail?: string,
        public picked?: boolean,
        public alwaysShow?: boolean
    ) {

    }
}

function isCommand(item: QuickPickItem | QuickPickCommand): item is QuickPickCommand {
    return item['command'];
}

export abstract class OpenShiftItem {
    protected static readonly odo: Odo = OdoImpl.Instance;
    protected static readonly explorer: OpenShiftExplorer = OpenShiftExplorer.getInstance();

    static validateUniqueName(data: Array<OpenShiftObject>, value: string) {
        const openshiftObject =  data.find((openshiftObject) =>  openshiftObject.getName() === value);
        return openshiftObject && `This name is already used, please enter different name.`;
    }

    static async getName(message: string, data: Array<OpenShiftObject>, offset?: string): Promise<string> {
        return await window.showInputBox({
            prompt: `Provide ${message}`,
            validateInput: (value: string) => {
                let validationMessage = OpenShiftItem.emptyName(`Empty ${message}`, value.trim());
                if (!validationMessage) validationMessage = OpenShiftItem.validateMatches(`Not a valid ${message}. Please use lower case alphanumeric characters or "-", start with an alphabetic character, and end with an alphanumeric character`, value);
                if (!validationMessage) validationMessage = OpenShiftItem.lengthName(`${message} should be between 2-63 characters`, value, offset ? offset.length : 0);
                if (!validationMessage) validationMessage = OpenShiftItem.validateUniqueName(data, value);
                return validationMessage;
            }
        });
    }

    static emptyName(message: string, value: string) {
        return validator.isEmpty(value) ? message : null;
    }

    static lengthName(message: string, value: string, offset: number) {
        return validator.isLength(value, 2, 63 - offset) ? null : message;
    }

    static validateUrl(message: string, value: string) {
        return validator.isURL(value) ? null : message;
    }

    static validateMatches(message: string, value: string) {
        return (validator.matches(value, '^[a-z]([-a-z0-9]*[a-z0-9])*$')) ? null : message;
    }

    static clusterURL(value: string) {
        const urlRegex = value.match('(https?:\/\/[^ ]*)');
        return (urlRegex) ? urlRegex[0] : null;
    }

    static ocLoginCommandMatches(value: string) {
        const ocloginRegex = /oc login (http|https):(.*?) --token=(.*)/;
        return ocloginRegex.test(value) ? value : null;
    }

    static getToken(value: string) {
        const tokenRegex = value.match('--token\s*=\s*(.*)');
        return (tokenRegex) ? tokenRegex[1] : null;
    }

    static async getProjectNames(): Promise<OpenShiftObject[]> {
        const projectList: Array<OpenShiftObject> = await OpenShiftItem.odo.getProjects();
        if (projectList.length === 0) throw Error(errorMessage.Project);
        return projectList;
    }

    static async getApplicationNames(project: OpenShiftObject, createCommand: boolean = false): Promise<(OpenShiftObject | QuickPickCommand)[]> {
        const applicationList: Array<OpenShiftObject> = await OpenShiftItem.odo.getApplications(project);
        return createCommand ? [...applicationList, new QuickPickCommand('Create new Application...', async () => {
            return await OpenShiftItem.getName('Application name', applicationList);
        })] : applicationList;
    }

    static async getComponentNames(application: OpenShiftObject) {
        const applicationList: Array<OpenShiftObject> = await OpenShiftItem.odo.getComponents(application);
        if (applicationList.length === 0) throw Error(errorMessage.Component);
        return applicationList;
    }

    static async getServiceNames(application: OpenShiftObject) {
        const serviceList: Array<OpenShiftObject> = await OpenShiftItem.odo.getServices(application);
        if (serviceList.length === 0) throw Error(errorMessage.Service);
        return serviceList;
    }

    static async getStorageNames(component: OpenShiftObject) {
        const storageList: Array<OpenShiftObject> = await OpenShiftItem.odo.getStorageNames(component);
        if (storageList.length === 0) throw Error(errorMessage.Storage);
        return storageList;
    }

    static async getRoutes(component: OpenShiftObject) {
        const urlList: Array<OpenShiftObject> = await OpenShiftItem.odo.getRoutes(component);
        if (urlList.length === 0) throw Error(errorMessage.Route);
        return urlList;
    }

    static async getOpenShiftCmdData(treeItem: OpenShiftObject, projectPlaceholder: string, appPlaceholder?: string, compPlaceholder?: string) {
        let context: OpenShiftObject | QuickPickCommand = treeItem;
        let project: OpenShiftObject;
        if (!context) context = await window.showQuickPick(OpenShiftItem.getProjectNames(), {placeHolder: projectPlaceholder});
        if (context && appPlaceholder) {
            project = context as OpenShiftObject;
            context = await window.showQuickPick<OpenShiftObject | QuickPickCommand>(OpenShiftItem.getApplicationNames(context as OpenShiftObject, appPlaceholder && compPlaceholder === undefined), {placeHolder: appPlaceholder});
            if (context && isCommand(context)) {
                context = new OpenShiftObjectImpl(project, await context.command(), ContextType.APPLICATION, OdoImpl.Instance, TreeItemCollapsibleState.Collapsed )
            }
        }
        if (context && compPlaceholder) context = await window.showQuickPick(OpenShiftItem.getComponentNames(context as OpenShiftObject), {placeHolder: compPlaceholder});
        return context as OpenShiftObject;
    }
}