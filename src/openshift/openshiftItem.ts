/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { commands, QuickPickItem, window } from 'vscode';
import { OpenShiftExplorer } from '../explorer';
import { getInstance, Odo, OpenShiftObject } from '../odo';
import { Project } from '../odo/project';
import { ServerlessFunctionView } from '../serverlessFunction/view';
import * as NameValidator from './nameValidator';

export class QuickPickCommand implements QuickPickItem {
    constructor (public label: string,
        public command: () => Promise<string>,
        public description?: string,
        public detail?: string,
        public picked?: boolean,
        public alwaysShow?: boolean,
        public getName?: () => string
    ) {
    }
}

export default class OpenShiftItem {
    protected static readonly odo: Odo = getInstance();

    protected static readonly explorer: OpenShiftExplorer = OpenShiftExplorer.getInstance();

    protected static readonly serverlessView: ServerlessFunctionView = ServerlessFunctionView.getInstance();

    static validateUniqueName(data: Array<OpenShiftObject>, value: string): string {
        const openshiftObject =  data.find((item) => item.getName() === value);
        return openshiftObject && 'This name is already used, please enter different name.';
    }

    static async getName(message: string, data: Promise<Array<OpenShiftObject>>, offset?: string, defaultValue = ''): Promise<string> {
        return window.showInputBox({
            value: defaultValue,
            prompt: `Provide ${message}`,
            ignoreFocusOut: true,
            validateInput: async (value: string) => {
                let validationMessage = NameValidator.emptyName(`Empty ${message}`, value.trim());
                if (!validationMessage) validationMessage = NameValidator.validateMatches(`Not a valid ${message}. Please use lower case alphanumeric characters or '-', start with an alphabetic character, and end with an alphanumeric character`, value);
                if (!validationMessage) validationMessage = NameValidator.lengthName(`${message} should be between 2-63 characters`, value, offset ? offset.length : 0);
                if (!validationMessage) {
                    try {
                        const existingResources = await data;
                        validationMessage = OpenShiftItem.validateUniqueName(existingResources, value);
                    } catch (err) {
                        //ignore to keep other validation to work
                    }
                }
                return validationMessage;
            }
        });
    }

    static async getProjectName(message: string, data: Promise<Array<Project>>, offset?: string, defaultValue = ''): Promise<string> {
        return window.showInputBox({
            value: defaultValue,
            prompt: `Provide ${message}`,
            ignoreFocusOut: true,
            validateInput: async (value: string) => {
                let validationMessage = NameValidator.emptyName(`Empty ${message}`, value.trim());
                if (!validationMessage) validationMessage = NameValidator.validateRFC1123DNSLabel(`Not a valid ${message}. Please enter name that starts with an alphanumeric character, use lower case alphanumeric characters or '-' and end with an alphanumeric character`, value);
                if (!validationMessage) validationMessage = NameValidator.lengthName(`${message} should be between 2-63 characters`, value, offset ? offset.length : 0);
                if (!validationMessage) {
                    try {
                        const existingProjects = await data;
                        const existingProject =  existingProjects.find((item) => item.name === value);
                        validationMessage = existingProject && 'This name is already used, please enter different name.';
                    } catch (err) {
                        //ignore to keep other validation to work
                    }
                }
                return validationMessage;
            }
        });
    }

}

export function clusterRequired() {
    return function (_target: any, key: string, descriptor: any): void {
        let fnKey: string | undefined;
        // eslint-disable-next-line @typescript-eslint/ban-types
        let fn: Function | undefined;

        if (typeof descriptor.value === 'function') {
            fnKey = 'value';
            fn = descriptor.value;
        } else {
            throw new Error('not supported');
        }

        descriptor[fnKey] = async function (...args: any[]): Promise<any> {
            let hasActiveCluster = await getInstance().canCreatePod();
            if (!hasActiveCluster) {
                const lOrC = await window.showInformationMessage('Login in to a Cluster to run this command.', 'Login', 'Cancel');
                if (lOrC === 'Login') {
                    const loginResult = await commands.executeCommand('openshift.explorer.login');
                    if (typeof loginResult === 'string') {
                        void window.showInformationMessage(loginResult);
                    }
                    hasActiveCluster = await getInstance().canCreatePod();
                }
            }
            if (hasActiveCluster) {
                return fn.apply(this, args);
            }
        };
    };
}
