/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Odo, OdoImpl, OpenShiftObject } from '../odo';
import { OpenShiftExplorer } from '../explorer';
import { window } from 'vscode';
import * as validator from 'validator';

const errorMessage = {
    Project: 'You need at least one Project available. Please create new OpenShift Project and try again.',
    Application: 'You need at least one Application available. Please create new OpenShift Application and try again.',
    Component: 'You need at least one Component available. Please create new OpenShift Component and try again.',
    Service: 'You need at least one Service available. Please create new OpenShift Service and try again.'
};

export abstract class OpenShiftItem {
    protected static readonly odo: Odo = OdoImpl.getInstance();
    protected static readonly explorer: OpenShiftExplorer = OpenShiftExplorer.getInstance();

    static create(context: OpenShiftObject): Promise<String> {
        return Promise.reject();
    }

    static del(context: OpenShiftObject): Promise<String> {
        return Promise.reject();
    }

    static wait(timeout: number = 2500): Promise<void> {
        return new Promise((res) => setTimeout(res, timeout));
    }

    static emptyName(message: string, value: string) {
        return validator.isEmpty(value) ? message : undefined;
    }

    static validateUrl(message: string, value: string) {
        return validator.isURL(value) ? undefined : message;
    }

    static validateMatches(message: string, value: string) {
        return (validator.matches(value, '^[a-z0-9]([-a-z0-9]*[a-z0-9])*$')) ? undefined : message;
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