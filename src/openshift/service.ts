/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject, Command } from '../odo';
import * as vscode from 'vscode';
import { Progress } from '../util/progress';

export class Service extends OpenShiftItem {

    static async create(application: OpenShiftObject): Promise<string>  {
        const applicationName: OpenShiftObject = await Service.getApplicationData(application);
        if (applicationName) {
            const serviceTemplateName = await vscode.window.showQuickPick(Service.odo.getServiceTemplates(), {
                placeHolder: "Service Template Name"
            });
            if (!serviceTemplateName) return null;

            const serviceTemplatePlanName = await vscode.window.showQuickPick(Service.odo.getServiceTemplatePlans(serviceTemplateName), {
                placeHolder: "Service Template Plan Name"
            });
            if (!serviceTemplatePlanName) return null;

            const serviceName = await vscode.window.showInputBox({
                value: serviceTemplateName,
                prompt: 'Service Name',
                validateInput: (value: string) => {
                    // required, because dc name is ${component}-${app}
                    let message: string = null;
                    if (`${value.trim()}-${applicationName.getName()}`.length > 63) {
                        message = 'Service name cannot be more than 63 characters';
                    }
                    return message;
                }
            });
            if (serviceName) {
                const project = applicationName.getParent();
                return Progress.execCmdWithProgress(`Creating new service '${serviceName}'`,
                    Command.createService(project.getName(), applicationName.getName(), serviceTemplateName, serviceTemplatePlanName, serviceName.trim()))
                    .then(() => Service.explorer.refresh())
                    .then(() => `Service '${serviceName}' successfully created`)
                    .catch((err) => Promise.reject(`Failed to create service with error '${err}'`));
            }
            return null;
        }
    }

    static async getApplicationData(application) {
        let applicationName: OpenShiftObject  = application ? application : undefined;
        let name: OpenShiftObject;
        if (!applicationName) {
            name = await Service.getProjectName();
        }
        if (applicationName) {
            applicationName = application;
        }
        return name || applicationName ? name || applicationName : undefined;
    }

    static async getProjectName() {
        let application: OpenShiftObject;
        const project: OpenShiftObject = await vscode.window.showQuickPick(Service.getProjectNames(), {placeHolder: "In which Project you want to create an Application"});
        if (project) {
            application = await vscode.window.showQuickPick(Service.getApplicationNames(project), {placeHolder: "In which Project you want to create an Application"});
        }
        return application ? application: undefined;
    }

    static async getProjectNames() {
        const projectList: Array<OpenShiftObject> = await Service.odo.getProjects();
        if (projectList.length === 0) {
           throw Error('You need at least one Project available to create an Service. Please create new OpenShift Project and try again.');
        }
        return projectList;
    }

    static async getApplicationNames(project) {
        const ApplicationList: Array<OpenShiftObject> = await Service.odo.getApplications(project);
        if (ApplicationList.length === 0) {
           throw Error('You need at least one Application available to create an Service. Please create new OpenShift Application and try again.');
        }
        return ApplicationList;
    }

    static async del(treeItem: OpenShiftObject): Promise<string> {
        let project: OpenShiftObject;
        let application: OpenShiftObject;
        let service: OpenShiftObject = treeItem;
        if (!service) {
            project = await vscode.window.showQuickPick(Service.odo.getProjects(), {placeHolder: "From which project you want to delete service"});
            application = await vscode.window.showQuickPick(Service.odo.getApplications(project), {placeHolder: "From which application you want to delete service"});
            if (application) {
                service = await vscode.window.showQuickPick(Service.odo.getServices(application), {placeHolder: "Select service to delete"});
            }
        }
        if (service) {
            application = service.getParent();
            project = application.getParent();
            const answer = await vscode.window.showWarningMessage(`Are you sure you want to delete service '${service.getName()}'`, 'Yes', 'Cancel');
            if (answer === 'Yes') {
                return Promise.resolve()
                    .then(() => Service.odo.execute(Command.deleteService(project.getName(), application.getName(), service.getName())))
                    .then(() => Service.explorer.refresh(treeItem ? treeItem.getParent() : undefined))
                    .then(() => `Service '${service.getName()}' successfully deleted`)
                    .catch((err) => Promise.reject(`Failed to delete service with error '${err}'`));
            }
        }
        return null;
    }
}