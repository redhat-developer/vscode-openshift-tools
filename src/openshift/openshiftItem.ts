/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/ban-types */

import { window, QuickPickItem, commands, workspace } from 'vscode';
import validator from 'validator';
import { Odo, getInstance, OpenShiftObject, ContextType, OpenShiftApplication, OpenShiftProject } from '../odo';
import { OpenShiftExplorer } from '../explorer';
import { VsCommandError } from '../vscommand';

const errorMessage = {
    Project: 'You need at least one Project available. Please create new OpenShift Project and try again.',
    Application: 'You need at least one Application available. Please create new OpenShift Application and try again.',
    Component: 'You need at least one Component available. Please create new OpenShift Component and try again.',
    Service: 'You need at least one Service available. Please create new OpenShift Service and try again.'
};

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

function isCommand(item: QuickPickItem | QuickPickCommand): item is QuickPickCommand {
    return !!(item as any).command;
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

    static async getProjectName(message: string, data: Promise<Array<OpenShiftObject>>, offset?: string, defaultValue = ''): Promise<string> {
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

    static async getApplicationNames(project: OpenShiftObject, createCommand = false): Promise<Array<OpenShiftObject | QuickPickCommand>> {
        if (project.getParent()) {
            const applicationList = await OpenShiftItem.odo.getApplications(project);
            if (applicationList.length === 0 && !createCommand) {
                throw new VsCommandError(errorMessage.Component);
            }
            if (createCommand) {
                return [
                    new QuickPickCommand(
                        '$(plus) Create new Application...',
                        async () => OpenShiftItem.getName('Application name', Promise.resolve(applicationList))
                    ),
                    ...applicationList
                ];
            }
            return applicationList;
        }
        return [
            new QuickPickCommand(
                '$(plus) Create new Application...',
                async () => OpenShiftItem.getName('Application name', Promise.resolve([]))
            )
        ];
    }

    static async getComponentNames(application: OpenShiftObject, condition?: (value: OpenShiftObject) => boolean): Promise<OpenShiftObject[]> {
        const applicationList: Array<OpenShiftObject> = await OpenShiftItem.odo.getComponents(application, condition);
        if (applicationList.length === 0) {
            throw new VsCommandError(errorMessage.Component);
        }
        return applicationList;
    }

    static async getServiceNames(application: OpenShiftObject): Promise<OpenShiftObject[]> {
        const serviceList: Array<OpenShiftObject> = await OpenShiftItem.odo.getServices(application);
        if (serviceList.length === 0) {
            throw new VsCommandError(errorMessage.Service);
        }
        return serviceList;
    }

    static async getOpenShiftCmdData<T extends OpenShiftObject>(treeItem: T, appPlaceholder?: string, compPlaceholder?: string, condition?: (value: OpenShiftObject) => boolean): Promise<T | null> {
        let context: OpenShiftObject | QuickPickCommand = treeItem;
        let project: OpenShiftObject;
        if (!context) {

            const clusters = await this.odo.getClusters();
            if (clusters.length) { // connected to cluster because odo version printed out server url
                const projects = await this.odo.getProjects();
                context = projects.find((prj:OpenShiftProject)=>prj.active);
                if (!context) {
                    throw new VsCommandError(errorMessage.Project)
                }
                // first try to get target component out of active editor
                const currentEditorFile = window?.activeTextEditor?.document?.uri;
                if (currentEditorFile) {
                    const contextFolder = workspace.getWorkspaceFolder(currentEditorFile);
                    if (contextFolder) {
                        const oso = this.odo.getOpenShiftObjectByContext(contextFolder.uri.fsPath);
                        if (!oso) {
                            const applications = await this.odo.getApplications(context);
                            const settings = this.odo.getSettingsByContext(contextFolder.uri.fsPath);
                            if (settings) {
                                const app = applications.find((a) => a.getName() === settings.spec.app);
                                if(app) {
                                    await this.odo.getComponents(app);
                                    context = this.odo.getOpenShiftObjectByContext(contextFolder.uri.fsPath);
                                }
                            }
                        } else if (context?.getName() === oso?.getParent()?.getParent()?.getName()) {
                            context = oso;
                        }
                    }
                }
            } else { // cluster is not accessible or user not logged in
                const projectName = await OpenShiftItem.getName('Project Name', Promise.resolve([]))
                    if (projectName) {
                        context = new OpenShiftProject(undefined, projectName, true);
                    } else {
                        context = null;
                    }
            }
        }
        if (context && !isCommand(context) && context.contextValue === ContextType.PROJECT && appPlaceholder ) {
            project = context;
            const applicationList = await OpenShiftItem.getApplicationNames(project, appPlaceholder.includes('create') && compPlaceholder === undefined);
            if ( applicationList.length === 1 && isCommand(applicationList[0])) {
                context = applicationList[0];
            } else {
                context = await window.showQuickPick<OpenShiftObject | QuickPickCommand>(applicationList, {placeHolder: appPlaceholder, ignoreFocusOut: true});
            }
            if (context && isCommand(context)) {
                const newAppName = 'app';
                if (newAppName) {
                    context = new OpenShiftApplication(project, newAppName);
                } else {
                    context = null;
                }
            }
        }
        if (context && !isCommand(context) && context.contextValue === ContextType.APPLICATION && compPlaceholder) {
            context = await window.showQuickPick(OpenShiftItem.getComponentNames(context, condition), {placeHolder: compPlaceholder, ignoreFocusOut: true});
        }
        return context as T;
    }
}

function selectTargetDecoratorFactory(decorator: (...args:any[]) => Promise<OpenShiftObject> ) {
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
            args[0] = await decorator(args[0]);
            return fn.apply(this, args);
        };
    };
}

export function selectTargetComponent(appPlaceHolder, cmpPlaceHolder, condition?: (value: OpenShiftObject) => boolean): (_target: any, key: string, descriptor: any) => void {
    return selectTargetDecoratorFactory(async (context) => OpenShiftItem.getOpenShiftCmdData(context, appPlaceHolder, cmpPlaceHolder, condition));
}

export function selectTargetApplication(appPlaceHolder): (_target: any, key: string, descriptor: any) => void {
    return selectTargetDecoratorFactory(async (context) => OpenShiftItem.getOpenShiftCmdData(context, appPlaceHolder));
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
            let clusters = await getInstance().getClusters()
            if (clusters.length === 0) {
                const lOrC = await window.showInformationMessage('Login in to a Cluster to run this command.', 'Login', 'Cancel');
                if(lOrC === 'Login') {
                    const loginResult = await commands.executeCommand('openshift.explorer.login');
                    if (typeof loginResult === 'string') {
                        window.showInformationMessage(loginResult);
                    }
                    clusters = await getInstance().getClusters();
                }
            }
            if (clusters.length) {
                return fn.apply(this, args);
            }
            return;
        };
    };
}
