/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject } from '../odo';
import * as vscode from 'vscode';
import { Progress } from '../util/progress';
export class Service extends OpenShiftItem {
    static async create(application: OpenShiftObject): Promise<string>  {
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
                if (`${value.trim()}-${application.getName()}`.length > 63) {
                    message = 'Service name cannot be more than 63 characters';
                }
                return message;
            }
        });
        if (serviceName) {
            const project = application.getParent();
            return Promise.resolve().then(() =>
                Progress.execWithProgress({
                    cancellable: false,
                    location: vscode.ProgressLocation.Notification,
                    title: `Creating new service '${serviceName}'`
                }, [{command: `odo service create ${serviceTemplateName} --plan ${serviceTemplatePlanName} ${serviceName.trim()} --app ${application.getName()} --project ${project.getName()}`, increment: 100}
                ], Service.odo))
                .then(() => Service.explorer.refresh(application))
                .then(() => `Service '${serviceName}' successfully created`)
                .catch((err) => Promise.reject(`Failed to create service with error '${err}'`));
        }
        return null;
    }

    static async link(context: OpenShiftObject): Promise<String> {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        const componentToLink = await vscode.window.showQuickPick(Service.odo.getComponents(app), {placeHolder: "Select the component to link"});
        if (!componentToLink) return null;

        return Promise.resolve()
        .then(() => Service.odo.execute(`odo link ${context.getName()} --app ${app.getName()} --project ${project.getName()} --component ${componentToLink.getName()}`))
        .then(() => `service '${context.getName()}' successfully linked with component '${componentToLink.getName()}'`)
        .catch((err) => Promise.reject(`Failed to link service with error '${err}'`));
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
                    .then(() => Service.odo.execute(`odo service delete ${service.getName()} -f --project ${project.getName()} --app ${application.getName()}`))
                    .then(() => Service.explorer.refresh(treeItem ? treeItem.getParent() : undefined))
                    .then(() => `Service '${service.getName()}' successfully deleted`)
                    .catch((err) => Promise.reject(`Failed to delete service with error '${err}'`));
            }
        }
        return null;
    }
}