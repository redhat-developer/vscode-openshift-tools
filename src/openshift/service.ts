/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window, QuickPickItem } from 'vscode';
import OpenShiftItem, { clusterRequired } from './openshiftItem';
import { OpenShiftObject } from '../odo';
import { Command } from '../odo/command';
import { Progress } from '../util/progress';
import { Platform } from '../util/platform';
import { vsCommand, VsCommandError } from '../vscommand';
import { ServiceOperatorShortInfo } from '../odo/service';
import { ClusterServiceVersionKind } from '../k8s/olm/types';

import { ClusterServiceVersion } from '../k8s/csv';

export class Service extends OpenShiftItem {

    @vsCommand('openshift.service.create')
    @clusterRequired()
    static async create(context: OpenShiftObject): Promise<string>  {
        const application = await Service.getOpenShiftCmdData(context,
            'In which Application you want to create a Service'
        );
        if (!application) return null;
        const sbos = await Service.odo.getServiceOperators();
        const operator = await window.showQuickPick(sbos.map((sbo:ServiceOperatorShortInfo) => {
                return {name: sbo.name, label: `${sbo.displayName} ${sbo.version}`, description: sbo.description};
            }), {
            placeHolder: 'Service Operator Name',
                ignoreFocusOut: true
        });
        if (!operator) return null;

        const csv: ClusterServiceVersionKind = await Service.odo.getClusterServiceVersion(operator.name);
        const selectedCrd = await window.showQuickPick(csv.spec.customresourcedefinitions.owned.map(crd=> {
            return {label: `${crd.displayName} ${crd.version}`, target: crd};
        }), {
            placeHolder: 'Service Name',
            ignoreFocusOut: true
        });
        if (!selectedCrd) return null;
        await ClusterServiceVersion.createNewServiceFromDescriptor(selectedCrd.target, csv, application);
    }

    @vsCommand('openshift.service.delete', true)
    @clusterRequired()
    static async del(treeItem: OpenShiftObject): Promise<string> {
        let service = treeItem;

        if (!service) {
            const application: OpenShiftObject = await Service.getOpenShiftCmdData(service,
                'From which Application you want to delete Service'
            );
            if (application) {
                service = await window.showQuickPick(Service.getServiceNames(application), {placeHolder: 'Select Service to delete',
                ignoreFocusOut: true});
            }
        }
        if (service) {
            const answer = await window.showWarningMessage(`Do you want to delete Service '${service.getName()}'?`, 'Yes', 'Cancel');
            if (answer === 'Yes') {
                return Progress.execFunctionWithProgress(`Deleting Service '${service.getName()}' from Application '${service.getParent().getName()}'`, () => Service.odo.deleteService(service))
                    .then(() => `Service '${service.getName()}' successfully deleted`)
                    .catch((err) => Promise.reject(new VsCommandError(`Failed to delete Service with error '${err}'`, 'Failed to delete Service')));
            }
        }
        return null;
    }

    @vsCommand('openshift.service.describe', true)
    @clusterRequired()
    static async describe(context: OpenShiftObject): Promise<void> {
        let service = context;

        if (!service) {
            const application: OpenShiftObject = await Service.getOpenShiftCmdData(context,
                'From which application you want to describe Service');
            if (application) {
                service = await window.showQuickPick(Service.getServiceNames(application), {placeHolder: 'Select Service you want to describe',
                ignoreFocusOut: true});
            }
        }
        if (service) {
            const template = await Service.getTemplate(service);
            if (template) {
                Service.odo.executeInTerminal(Command.describeService(template), Platform.getUserHomePath(), `OpenShift: Describe '${service.getName()}' Service`);
            } else {
                throw new VsCommandError(`Cannot get Service Type name for Service '${service.getName()}'`, 'Cannot get Service Type name for Service');
            }
        }
    }

    static async getTemplate(service: OpenShiftObject): Promise<string> {
        const result = await Service.odo.execute(Command.getServiceTemplate(service.getParent().getParent().getName(), service.getName()));
        return result.stdout.trim();
    }
}
