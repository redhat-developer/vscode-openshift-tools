/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Odo, OdoImpl, OpenShiftObject } from '../odo';
import { OpenShiftExplorer } from '../explorer';
import { window } from 'vscode';
import * as validator from 'validator';
import * as path from 'path';
import { Platform } from '../util/platform';

const errorMessage = {
    Project: 'You need at least one Project available. Please create new OpenShift Project and try again.',
    Application: 'You need at least one Application available. Please create new OpenShift Application and try again.',
    Component: 'You need at least one Component available. Please create new OpenShift Component and try again.',
    Service: 'You need at least one Service available. Please create new OpenShift Service and try again.',
    Storage: 'You need at least one Storage available. Please create new OpenShift Storage and try again.'
};

export abstract class OpenShiftItem {
    protected static readonly odo: Odo = OdoImpl.getInstance();
    protected static readonly explorer: OpenShiftExplorer = OpenShiftExplorer.getInstance();

    static wait(timeout: number = 2500): Promise<void> {
        return new Promise((res) => setTimeout(res, timeout));
    }

    static validateUniqueName(data: Array<OpenShiftObject>, value: string) {
        const openshiftObject =  data.find((openshiftObject) =>  openshiftObject.getName() === value);
        return openshiftObject && `This name is already used, please enter different name.`;
    }

    static async getName(message: string, data: Array<OpenShiftObject>, offset?: string): Promise<string> {
        return await window.showInputBox({
            prompt: `Provide ${message}`,
            validateInput: (value: string) => {
                let validationMessage = OpenShiftItem.emptyName(`Empty ${message}`, value.trim());
                if (!validationMessage) validationMessage = OpenShiftItem.validateMatches(`Not a valid ${message}. Please use lower case alphanumeric characters or "-", and must start and end with an alphanumeric character`, value);
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

    static isPosixAbsolute(message: string, value: string) {
        return path.posix.isAbsolute(value) ? null : message;
    }

    static pathValidation(message: string, value: string) {
        const pathValidator = /^((?!\\).)*$/;
        if (Platform.OS === 'darwin' || Platform.OS === 'linux') {
            return pathValidator.test(value) ? null : message;
        }
    }

    static validateMatches(message: string, value: string) {
        return (validator.matches(value, '^[a-z0-9]([-a-z0-9]*[a-z0-9])*$')) ? null : message;
    }

    static async getProjectNames(): Promise<OpenShiftObject[]> {
        const projectList: Array<OpenShiftObject> = await OpenShiftItem.odo.getProjects();
        if (projectList.length === 0) throw Error(errorMessage.Project);
        return projectList;
    }

    static async getApplicationNames(project: OpenShiftObject) {
        const applicationList: Array<OpenShiftObject> = await OpenShiftItem.odo.getApplications(project);
        if (applicationList.length === 0) throw Error(errorMessage.Application);
        return applicationList;
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

    static async getOpenShiftCmdData(treeItem: OpenShiftObject, projectPlaceholder: string, appPlaceholder?: string, compPlaceholder?: string) {
        let context = treeItem;
        if (!context) {
            context = await window.showQuickPick(OpenShiftItem.getProjectNames(), {placeHolder: projectPlaceholder});
            if (context && appPlaceholder) context = await window.showQuickPick(OpenShiftItem.getApplicationNames(context), {placeHolder: appPlaceholder});
            if (context && compPlaceholder) context = await window.showQuickPick(OpenShiftItem.getComponentNames(context), {placeHolder: compPlaceholder});
        }
        return context;
    }
}