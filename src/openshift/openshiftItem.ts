/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/ban-types */

import * as path from 'path';
import validator from 'validator';
import { QuickPickItem, commands, window } from 'vscode';
import { OpenShiftExplorer } from '../explorer';
import { Odo, OpenShiftObject, getInstance } from '../odo';
import { Project } from '../odo/project';

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
                let validationMessage = OpenShiftItem.emptyName(`Empty ${message}`, value.trim());
                if (!validationMessage) validationMessage = OpenShiftItem.validateMatches(`Not a valid ${message}. Please use lower case alphanumeric characters or '-', start with an alphabetic character, and end with an alphanumeric character`, value);
                if (!validationMessage) validationMessage = OpenShiftItem.lengthName(`${message} should be between 2-63 characters`, value, offset ? offset.length : 0);
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
                let validationMessage = OpenShiftItem.emptyName(`Empty ${message}`, value.trim());
                if (!validationMessage) validationMessage = OpenShiftItem.validateRFC1123DNSLabel(`Not a valid ${message}. Please enter name that starts with an alphanumeric character, use lower case alphanumeric characters or '-' and end with an alphanumeric character`, value);
                if (!validationMessage) validationMessage = OpenShiftItem.lengthName(`${message} should be between 2-63 characters`, value, offset ? offset.length : 0);
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

    static emptyName(message: string, value: string): string | null {
        return validator.isEmpty(value) ? message : null;
    }

    static lengthName(message: string, value: string, offset: number): string | null {
        return validator.isLength(value, {min: 2, max: 63 - offset}) ? null : message;
    }

    static validateUrl(message: string, value: string): string | null {
        return validator.isURL(value) ? null : message;
    }

    static validateMatches(message: string, value: string): string | null {
        return validator.matches(value, '^[a-z]([-a-z0-9]*[a-z0-9])*$') ? null : message;
    }

    static validateFilePath(message: string, value: string): string | null {
        const proposedPath = path.parse(value);
        return /^devfile\.ya?ml$/i.test(proposedPath.base) ? null : message;
    }

    static validateRFC1123DNSLabel(message: string, value: string): string | null {
      return validator.matches(value, '^[a-z0-9]([-a-z0-9]*[a-z0-9])*$') ? null : message;
    }

    static clusterURL(value: string): string | null {
        const urlRegex = value.match(/--server=(https?:\/\/[^ ]*)/);
        return urlRegex ? urlRegex[1] : null;
    }

    static ocLoginCommandMatches(value: string): string | null {
        return OpenShiftItem.clusterURL(value) !== null && OpenShiftItem.getToken(value) !== null ? value : null;
    }

    static getToken(value: string): string | null {
        const tokenRegex = value.match(/--token\s*=\s*(\S*).*/);
        return tokenRegex ? tokenRegex[1] : null;
    }

}

export function clusterRequired() {
    return function (_target: any, key: string, descriptor: any): void {
        let fnKey: string | undefined;
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
                        window.showInformationMessage(loginResult);
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
