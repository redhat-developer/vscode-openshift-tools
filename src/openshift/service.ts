/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject, Command } from '../odo';
import { window } from 'vscode';
import { Progress } from '../util/progress';

export class Service extends OpenShiftItem {

    static async create(context: OpenShiftObject): Promise<string>  {
        const application = await Service.getOpenShiftCmdData(context,
            "In which Project you want to create a Service",
            "In which Application you want to create a Service"
        );
        if (!application) return null;
        const serviceTemplateName = await window.showQuickPick(Service.odo.getServiceTemplates(), {
            placeHolder: "Service Template Name"
        });
        if (!serviceTemplateName) return null;

        const serviceTemplatePlanName = await window.showQuickPick(Service.odo.getServiceTemplatePlans(serviceTemplateName), {
            placeHolder: "Service Template Plan Name"
        });
        if (!serviceTemplatePlanName) return null;
        const serviceList: Array<OpenShiftObject> = await OpenShiftItem.odo.getServices(application);
        const serviceName = await Service.getName('Service name', serviceList, application.getName());
        if (!serviceName) return null;
        const project = application.getParent();
        return Progress.execFunctionWithProgress(`Creating a new Service '${serviceName}'`, () => Service.odo.createService(application, serviceTemplateName, serviceTemplatePlanName, serviceName.trim()))
            .then(() => `Service '${serviceName}' successfully created`)
            .catch((err) => Promise.reject(`Failed to create Service with error '${err}'`));
    }

    static async del(treeItem: OpenShiftObject): Promise<string> {
        let service = treeItem;

        if (!service) {
            const application: OpenShiftObject = await Service.getOpenShiftCmdData(service,
                "From which Project you want to delete Service",
                "From which Application you want to delete Service"
            );
            if (application) {
                service = await window.showQuickPick(Service.getServiceNames(application), {placeHolder: "Select Service to delete"});
            }
        }
        if (service) {
            const answer = await window.showWarningMessage(`Do you want to delete Service '${service.getName()}'?`, 'Yes', 'Cancel');
            if (answer === 'Yes') {
                return Progress.execFunctionWithProgress(`Deleting Service '${service.getName()}' from Application '${service.getParent().getName()}'`, (progress) => Service.odo.deleteService(service))
                    .then(() => `Service '${service.getName()}' successfully deleted`)
                    .catch((err) => Promise.reject(`Failed to delete Service with error '${err}'`));
            }
        }
        return null;
    }

    static async describe(context: OpenShiftObject): Promise<void> {
        let service = context;

        if (!service) {
            const application: OpenShiftObject = await Service.getOpenShiftCmdData(context,
                "From which project you want to describe Service",
                "From which application you want to describe Service");
            if (application) {
                service = await window.showQuickPick(Service.getServiceNames(application), {placeHolder: "Select Service you want to describe"});
            }
        }
        if (service) {
            const template = await Service.getTemplate(service);
            if (template) {
                Service.odo.executeInTerminal(Command.describeService(template));
            } else {
                throw Error(`Cannot get Service Type name for Service \'${service.getName()}\'`);
            }
        }
    }

    static async getTemplate(service: OpenShiftObject): Promise<string> {
        const result = await Service.odo.execute(Command.getServiceTemplate(service.getParent().getParent().getName(), service.getName()));
        return result.stdout.trim();
    }
}