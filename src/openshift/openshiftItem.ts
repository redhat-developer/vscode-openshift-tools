/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Odo, OdoImpl, OpenShiftObject } from '../odo';
import { OpenShiftExplorer } from '../explorer';

export abstract class OpenShiftItem {
    protected static readonly odo: Odo = OdoImpl.getInstance();
    protected static readonly explorer: OpenShiftExplorer = OpenShiftExplorer.getInstance();

    static create(context: OpenShiftObject): Promise<String> { return Promise.reject(); }
    static del(context: OpenShiftObject): Promise<String> { return Promise.reject(); }
    static wait(timeout: number = 2500): Promise<void> { return  new Promise((res)=>setTimeout(res, timeout)); }

    static async getProjectNames(): Promise<OpenShiftObject[]> {
        const projectList: Array<OpenShiftObject> = await OpenShiftItem.odo.getProjects();
        if (projectList.length === 0) {
           throw Error('You need at least one Project available. Please create new OpenShift Project and try again.');
        }
        return projectList;
    }

    static async getApplicationNames(project): Promise<OpenShiftObject[]> {
        const projectList: Array<OpenShiftObject> = await OpenShiftItem.odo.getApplications(project);
        if (projectList.length === 0) {
           throw Error('You need at least one Application available. Please create new OpenShift Application and try again.');
        }
        return projectList;
    }

    static async getComponentNames(application) {
        const applicationList: Array<OpenShiftObject> = await OpenShiftItem.odo.getComponents(application);
        if (applicationList.length === 0) {
            throw Error('You need at least one Component available. Please create new OpenShift Component and try again.');
        }
         return applicationList;
    }
}