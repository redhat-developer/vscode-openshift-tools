/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window, QuickPickItem } from 'vscode';
import * as validator from 'validator';
import { Odo, OdoImpl, OpenShiftObject, ContextType, OpenShiftApplication } from '../odo';
import { OpenShiftExplorer } from '../explorer';

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
        public alwaysShow?: boolean,
        public getName?: () => string
    ) { }
}

function isCommand(item: QuickPickItem | QuickPickCommand): item is QuickPickCommand {
    return (item as any).command;
}

export default class OpenShiftItem {
    protected static readonly odo: Odo = OdoImpl.Instance;

    protected static readonly explorer: OpenShiftExplorer = OpenShiftExplorer.getInstance();

    static validateUniqueName(data: Array<OpenShiftObject>, value: string): string {
        const openshiftObject =  data.find((item) => item.getName() === value);
        return openshiftObject && `This name is already used, please enter different name.`;
    }

    static getName(message: string, data: Array<OpenShiftObject>, offset?: string): Thenable<string> {
        return window.showInputBox({
            prompt: `Provide ${message}`,
            ignoreFocusOut: true,
            validateInput: (value: string) => {
                let validationMessage = OpenShiftItem.emptyName(`Empty ${message}`, value.trim());
                if (!validationMessage) validationMessage = OpenShiftItem.validateMatches(`Not a valid ${message}. Please use lower case alphanumeric characters or "-", start with an alphabetic character, and end with an alphanumeric character`, value);
                if (!validationMessage) validationMessage = OpenShiftItem.lengthName(`${message} should be between 2-63 characters`, value, offset ? offset.length : 0);
                if (!validationMessage) validationMessage = OpenShiftItem.validateUniqueName(data, value);
                return validationMessage;
            }
        });
    }

    static emptyName(message: string, value: string): string | null {
        return validator.isEmpty(value) ? message : null;
    }

    static lengthName(message: string, value: string, offset: number): string | null {
        return validator.isLength(value, 2, 63 - offset) ? null : message;
    }

    static validateUrl(message: string, value: string): string | null {
        return validator.isURL(value) ? null : message;
    }

    static validateMatches(message: string, value: string): string | null {
        return (validator.matches(value, '^[a-z]([-a-z0-9]*[a-z0-9])*$')) ? null : message;
    }

    static clusterURL(value: string): string | null {
        const urlRegex = value.match('(https?://[^ ]*)');
        return (urlRegex) ? urlRegex[0] : null;
    }

    static ocLoginCommandMatches(value: string): string | null {
        const ocLoginRegex = /oc login (http|https):(.*?) --token=(.*)/;
        return ocLoginRegex.test(value) ? value : null;
    }

    static getToken(value: string): string | null {
        const tokenRegex = value.match(/--token\s*=\s*(\S*).*/);
        return (tokenRegex) ? tokenRegex[1] : null;
    }

    static async getProjectNames(): Promise<OpenShiftObject[]> {
        const projectList: Array<OpenShiftObject> = await OpenShiftItem.odo.getProjects();
        if (projectList.length === 0) throw Error(errorMessage.Project);
        return projectList;
    }

    static async getApplicationNames(project: OpenShiftObject, createCommand = false): Promise<Array<OpenShiftObject | QuickPickCommand>> {
        const applicationList: Array<OpenShiftObject> = await OpenShiftItem.odo.getApplications(project);
        if (applicationList.length === 0 && !createCommand) throw Error(errorMessage.Component);
        return createCommand ? [new QuickPickCommand(`$(plus) Create new Application...`, async () => {
            return OpenShiftItem.getName('Application name', applicationList);
        }), ...applicationList] : applicationList;
    }

    static async getComponentNames(application: OpenShiftObject, condition?: (value: OpenShiftObject) => boolean): Promise<OpenShiftObject[]> {
        const applicationList: Array<OpenShiftObject> = await OpenShiftItem.odo.getComponents(application, condition);
        if (applicationList.length === 0) throw Error(errorMessage.Component);
        return applicationList;
    }

    static async getServiceNames(application: OpenShiftObject): Promise<OpenShiftObject[]> {
        const serviceList: Array<OpenShiftObject> = await OpenShiftItem.odo.getServices(application);
        if (serviceList.length === 0) throw Error(errorMessage.Service);
        return serviceList;
    }

    static async getStorageNames(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        const storageList: Array<OpenShiftObject> = await OpenShiftItem.odo.getStorageNames(component);
        if (storageList.length === 0) throw Error(errorMessage.Storage);
        return storageList;
    }

    static async getRoutes(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        const urlList: Array<OpenShiftObject> = await OpenShiftItem.odo.getRoutes(component);
        if (urlList.length === 0) throw Error(errorMessage.Route);
        return urlList;
    }

    static async getOpenShiftCmdData(treeItem: OpenShiftObject, projectPlaceholder: string, appPlaceholder?: string, compPlaceholder?: string, condition?: (value: OpenShiftObject) => boolean): Promise<OpenShiftObject | null>  {
        let context: OpenShiftObject | QuickPickCommand = treeItem;
        let project: OpenShiftObject;
        if (!context) context = await window.showQuickPick(OpenShiftItem.getProjectNames(), {placeHolder: projectPlaceholder, ignoreFocusOut: true});
        if (context && context.contextValue === ContextType.PROJECT && appPlaceholder ) {
            project = context;
            context = await window.showQuickPick<OpenShiftObject | QuickPickCommand>(OpenShiftItem.getApplicationNames(project, appPlaceholder.includes('create') && compPlaceholder === undefined), {placeHolder: appPlaceholder, ignoreFocusOut: true});
            if (context && isCommand(context)) {
                const newAppName = await context.command();
                if (newAppName) {
                    context = new OpenShiftApplication(project, newAppName);
                } else {
                    context = null;
                }
            }
        }
        if (context && !isCommand(context) && context.contextValue === ContextType.APPLICATION && compPlaceholder) context = await window.showQuickPick(OpenShiftItem.getComponentNames(context, condition), {placeHolder: compPlaceholder, ignoreFocusOut: true});
        return context as OpenShiftObject;
    }
}

function selectTargetDecoratorFactory(decorator: (...args:any[]) => Promise<OpenShiftObject> ) {
    return function (_target: any, key: string, descriptor: any): void {
        let fnKey: string | undefined;
        let fn: Function | undefined;

        if (typeof descriptor.value === 'function') {
            fnKey = 'value';
            fn = descriptor.value;
        } else {
            throw new Error('not supported');
        }

       descriptor[fnKey] = async function (...args: any[]) {
            args[0] = await decorator(args[0]);
            return fn.apply(this, args);
        };
    };
}

export function selectTargetComponent(prjPlaceHolder, appPlaceHolder, cmpPlaceHolder, condition?: (value: OpenShiftObject) => boolean) {
    return selectTargetDecoratorFactory(async (context) => OpenShiftItem.getOpenShiftCmdData(context, prjPlaceHolder, appPlaceHolder, cmpPlaceHolder, condition));
}

export function selectTargetApplication(prjPlaceHolder, appPlaceHolder) {
    return selectTargetDecoratorFactory(async (context) => OpenShiftItem.getOpenShiftCmdData(context, prjPlaceHolder, appPlaceHolder));
}
