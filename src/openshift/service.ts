/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window } from 'vscode';
import OpenShiftItem from './openshiftItem';
import { OpenShiftObject, Command } from '../odo';
import { Progress } from '../util/progress';
import { Platform } from '../util/platform';
import { vsCommand, VsCommandError } from '../vscommand';

export class Service extends OpenShiftItem {

    @vsCommand('openshift.service.create')
    static async create(context: OpenShiftObject): Promise<string>  {
        const application = await Service.getOpenShiftCmdData(context,
            "In which Project you want to create a Service",
            "In which Application you want to create a Service"
        );
        if (!application) return null;
        const serviceTemplateName = await window.showQuickPick(Service.odo.getServiceTemplates(), {
            placeHolder: "Service Template Name",
            ignoreFocusOut: true
        });
        if (!serviceTemplateName) return null;
        const plans: string[] = await Service.odo.getServiceTemplatePlans(serviceTemplateName);
        let serviceTemplatePlanName: string;
        if (plans.length === 1) {
            [serviceTemplatePlanName] = plans;
        } else if (plans.length > 1) {
            serviceTemplatePlanName = await window.showQuickPick(plans, {
                placeHolder: "Service Template Plan Name",
                ignoreFocusOut: true
            });
        } else {
            window.showErrorMessage('No Service Plans available for selected Service Template');
        }
        if (!serviceTemplatePlanName) return null;
        const serviceList: Array<OpenShiftObject> = await OpenShiftItem.odo.getServices(application);
        const serviceName = await Service.getName('Service name', serviceList, application.getName());
        if (!serviceName) return null;
        return Progress.execFunctionWithProgress(`Creating a new Service '${serviceName}'`, () => Service.odo.createService(application, serviceTemplateName, serviceTemplatePlanName, serviceName.trim()))
            .then(() => `Service '${serviceName}' successfully created`)
            .catch((err) => Promise.reject(new VsCommandError(`Failed to create Service with error '${err}'`)));
    }

    @vsCommand('openshift.service.delete', true)
    static async del(treeItem: OpenShiftObject): Promise<string> {
        let service = treeItem;

        if (!service) {
            const application: OpenShiftObject = await Service.getOpenShiftCmdData(service,
                "From which Project you want to delete Service",
                "From which Application you want to delete Service"
            );
            if (application) {
                service = await window.showQuickPick(Service.getServiceNames(application), {placeHolder: "Select Service to delete",
                ignoreFocusOut: true});
            }
        }
        if (service) {
            const answer = await window.showWarningMessage(`Do you want to delete Service '${service.getName()}'?`, 'Yes', 'Cancel');
            if (answer === 'Yes') {
                return Progress.execFunctionWithProgress(`Deleting Service '${service.getName()}' from Application '${service.getParent().getName()}'`, () => Service.odo.deleteService(service))
                    .then(() => `Service '${service.getName()}' successfully deleted`)
                    .catch((err) => Promise.reject(new VsCommandError(`Failed to delete Service with error '${err}'`)));
            }
        }
        return null;
    }

    @vsCommand('openshift.service.describe', true)
    static async describe(context: OpenShiftObject): Promise<void> {
        let service = context;

        if (!service) {
            const application: OpenShiftObject = await Service.getOpenShiftCmdData(context,
                "From which project you want to describe Service",
                "From which application you want to describe Service");
            if (application) {
                service = await window.showQuickPick(Service.getServiceNames(application), {placeHolder: "Select Service you want to describe",
                ignoreFocusOut: true});
            }
        }
        if (service) {
            const template = await Service.getTemplate(service);
            if (template) {
                Service.odo.executeInTerminal(Command.describeService(template), Platform.getUserHomePath(), `OpenShift: Describe '${service.getName()}' Service`);
            } else {
                throw new VsCommandError(`Cannot get Service Type name for Service '${service.getName()}'`);
            }
        }
    }

    static async getTemplate(service: OpenShiftObject): Promise<string> {
        const result = await Service.odo.execute(Command.getServiceTemplate(service.getParent().getParent().getName(), service.getName()));
        return result.stdout.trim();
    }
}
