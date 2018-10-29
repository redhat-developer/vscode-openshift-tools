import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject } from '../odo';
import * as vscode from 'vscode';
import { Progress } from '../util/progress';

export class Service extends OpenShiftItem {
    static async create(context: OpenShiftObject): Promise<string>  {
        try {
            const serviceTemplateNames: string[] = await Service.odo.getServiceTemplates();
            const serviceTemplateName = await vscode.window.showQuickPick(serviceTemplateNames, {
                placeHolder: "Service Template Name"
            });

            if (serviceTemplateName === undefined) return Promise.resolve(null);

            const serviceTemplatePlanNames: string[] = await Service.odo.getServiceTemplatePlans(serviceTemplateName);
            const serviceTemplatePlanName = await vscode.window.showQuickPick(serviceTemplatePlanNames, {
                placeHolder: "Service Template Plan Name"
            });

            if (serviceTemplatePlanName === undefined) return Promise.resolve(null);

            const serviceName = await vscode.window.showInputBox({
                value: serviceTemplateName,
                prompt: 'Service Name',
                validateInput: (value: string) => {
                    // required, because dc name is ${component}-${app}
                    let message: string = null;
                    if (`${value.trim()}-${context.getName()}`.length > 63) {
                        message = 'Service name cannot be more that 63 characters';
                    }
                    return message;
                }
            });
            if (serviceName) {
                await Progress.execWithProgress({
                    cancellable: false,
                    location: vscode.ProgressLocation.Notification,
                    title: `Creating new service '${serviceName}'`
                }, [{command: `odo project set ${context.getParent().getName()} && odo app set ${context.getName()} && odo service create ${serviceTemplateName} --plan ${serviceTemplatePlanName} ${serviceName.trim()}`, increment: 100}
                ], Service.odo).then(() => {
                    Service.explorer.refresh(context);
                    return `Service '${serviceName}' successfully created`;
                });
            }
            return Promise.resolve(null);
        } catch (e) {
            return Promise.reject(e.message.replace(/\w/, (c) => c.toUpperCase()));
        }
    }

    static async del(service: OpenShiftObject): Promise<string> {
        const value = await vscode.window.showWarningMessage(`Are you sure you want to delete service '${service.getName()}'`, 'Yes', 'Cancel');
        if (value === 'Yes') {
            return Service.odo.execute(`odo project set ${service.getParent().getParent().getName()} && odo app set ${service.getParent().getName()} && odo service delete ${service.getName()} -f`)
            .then(() => {
                Service.explorer.refresh(service.getParent());
                return `Service '${service.getName()} successfully deleted'`;
            })
            .catch((err) => { return Promise.reject(`Failed to delete service with error '${err}'`); });
        }
        return Promise.resolve(null);
    }
}