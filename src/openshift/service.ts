/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject, Command } from '../odo';
import * as vscode from 'vscode';
import { Progress } from '../util/progress';

export class Service extends OpenShiftItem {

    static async create(context: OpenShiftObject): Promise<string>  {
        const application = await Service.getOpenShiftCmdData(context,
            "In which Project you want to create a Service",
            "In which Application you want to create a Service"
        );
        if (application) {
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
                return Progress.execCmdWithProgress(`Creating a new Service '${serviceName}'`,
                    Command.createService(project.getName(), application.getName(), serviceTemplateName, serviceTemplatePlanName, serviceName.trim()))
                    .then(() => Service.explorer.refresh(context ? context : undefined))
                    .then(() => `Service '${serviceName}' successfully created`)
                    .catch((err) => Promise.reject(`Failed to create Service with error '${err}'`));
            }
            return null;
        }
    }

    static async del(treeItem: OpenShiftObject): Promise<string> {
        let service = treeItem;

        if (!service) {
            const application: OpenShiftObject = await Service.getOpenShiftCmdData(service,
                "From which Project you want to delete Service",
                "From which Application you want to delete Service"
            );
            if (application) {
                service = await vscode.window.showQuickPick(Service.getServiceNames(application), {placeHolder: "Select Service to delete"});
            }
        }
        if (service) {
            const answer = await vscode.window.showWarningMessage(`Do you want to delete Service '${service.getName()}'?`, 'Yes', 'Cancel');
            if (answer === 'Yes') {
                return Progress.execFunctionWithProgress(`Deleting Service '${service.getName()}' from Application '${service.getParent().getName()}'`,
                    (progress) => Service.odo.execute(Command.deleteService(service.getParent().getParent().getName(), service.getParent().getName(), service.getName()))
                        .then(() => Service.odo.execute(Command.waitForServiceToBeGone(service.getParent().getParent().getName(), service.getName())))
                        .then(() => Service.explorer.refresh(treeItem ? treeItem.getParent() : undefined))
                        .then(() => `Service '${service.getName()}' successfully deleted`)
                        .catch((err) => Promise.reject(`Failed to delete Service with error '${err}'`))
                );
            }
        }
        return null;
    }
}