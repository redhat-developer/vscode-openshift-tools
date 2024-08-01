/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { commands, QuickPickItem, window } from 'vscode';
import { ExecutionContext } from '../cli';
import { Oc } from '../oc/ocWrapper';
import { Project } from '../oc/project';
import { ServerlessFunctionView } from '../serverlessFunction/view';
import { inputValue } from '../util/inputValue';
import { getNamespaceKind } from '../util/kubeUtils';
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
    protected static readonly serverlessView: ServerlessFunctionView = ServerlessFunctionView.getInstance();

    static async getName(message: string, offset?: string, defaultValue = ''): Promise<string> {
        return await inputValue(`Provide ${message}`, defaultValue, false,
            (value: string) => {
                let validationMessage = NameValidator.emptyName(`Empty ${message}`, value.trim());
                if (!validationMessage) validationMessage = NameValidator.validateMatches(`Not a valid ${message}. Please use lower case alphanumeric characters or '-', start with an alphabetic character, and end with an alphanumeric character`, value);
                if (!validationMessage) validationMessage = NameValidator.lengthName(`${message} should be between 2-63 characters`, value, offset ? offset.length : 0);
                return validationMessage;
            }
        );
    }

    static async getProjectName(message: string, data: Promise<Array<Project>>, offset?: string, defaultValue = ''): Promise<string> {
        return await inputValue(`Provide ${message}`, defaultValue, false,
            async (value: string) => {
                let validationMessage = NameValidator.emptyName(`Empty ${message}`, value.trim());
                if (!validationMessage) validationMessage = NameValidator.validateRFC1123DNSLabel(`Not a valid ${message}. Please enter name that starts with an alphanumeric character, use lower case alphanumeric characters or '-' and end with an alphanumeric character`, value);
                if (!validationMessage) validationMessage = NameValidator.lengthName(`${message} should be between 2-63 characters`, value, offset ? offset.length : 0);
                if (!validationMessage) {
                    try {
                        const existingProjects = await data;
                        const existingProject =  existingProjects.find((item) => item.name === value);
                        validationMessage = existingProject && 'This name is already used, please enter different name.';
                    } catch {
                        //ignore to keep other validation to work
                    }
                }
                return validationMessage;
            }
        );
    }
}

export function clusterRequired() {
    return function (_target: any, key: string, descriptor: any): void {
        let fnKey: string | undefined;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        let fn: Function | undefined;

        if (typeof descriptor.value === 'function') {
            fnKey = 'value';
            fn = descriptor.value;
        } else {
            throw new Error('not supported');
        }

        descriptor[fnKey] = async function (...args: any[]): Promise<any> {
            let hasActiveCluster = await Oc.Instance.canCreatePod();
            if (!hasActiveCluster) {
                const lOrC = await window.showInformationMessage('Login in to a Cluster to run this command.', 'Login', 'Cancel');
                if (lOrC === 'Login') {
                    const loginResult = await commands.executeCommand('openshift.explorer.login');
                    if (typeof loginResult === 'string') {
                        void window.showInformationMessage(loginResult);
                    }
                    hasActiveCluster = await Oc.Instance.canCreatePod();
                }
            }
            if (hasActiveCluster) {
                return fn.apply(this, args);
            }
        };
    };
}

export function projectRequired() {
    return function (_target: any, key: string, descriptor: any): void {
        let fnKey: string | undefined;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        let fn: Function | undefined;

        if (typeof descriptor.value === 'function') {
            fnKey = 'value';
            fn = descriptor.value;
        } else {
            throw new Error('not supported');
        }

        descriptor[fnKey] = async function (...args: any[]): Promise<any> {
            const executionContext: ExecutionContext = new ExecutionContext();
            let projects = await Oc.Instance.getProjects(false, executionContext);
            let activeProject = await Oc.Instance.getActiveProject(executionContext);
            let activeProjectExists = projects.find(project => project.name === activeProject);
            if (activeProjectExists) {
                return fn.apply(this, args);
            }
            const kind = await getNamespaceKind(executionContext);
            const SELECT_PROJECT = `Select or Create ${kind}`;
            const result = await window.showWarningMessage(`The current ${kind} doesn't exist. Please select an existing ${kind} to work with or create a new ${kind}`, SELECT_PROJECT, 'Cancel');
            if (result === SELECT_PROJECT) {
                await commands.executeCommand('openshift.project.set');
                projects = await Oc.Instance.getProjects(false, executionContext);
                activeProject = await Oc.Instance.getActiveProject(executionContext);
                activeProjectExists = projects.find(project => project.name === activeProject);
                if (activeProjectExists) {
                    return fn.apply(this, args);
                }
            }
        };
    };
}
