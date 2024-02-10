/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubernetesObject } from '@kubernetes/client-node';
import * as path from 'path';
import validator from 'validator';
import { Disposable, QuickInputButtons, ThemeIcon, TreeItem, window } from 'vscode';
import { CommandText } from './base/command';
import { OpenShiftExplorer } from './explorer';
import { Oc } from './oc/ocWrapper';
import { validateRFC1123DNSLabel } from './openshift/nameValidator';
import { quickBtn } from './util/inputValue';
import { vsCommand } from './vscommand';
import { OpenShiftTerminalManager } from './webview/openshift-terminal/openShiftTerminal';

export class Deployment {

    @vsCommand('openshift.deployment.create.fromImageUrl')
    static async createFromImageUrl(context: TreeItem): Promise<void> {

        enum State {
            SelectImage, SelectName
        }

        let state: State = State.SelectImage;
        let imageUrl: string;

        while (state !== undefined) {

            switch (state) {

            case State.SelectImage: {

                imageUrl = await Deployment.getImageUrl(false, imageUrl);

                if (imageUrl === null || imageUrl === undefined) {
                    return;
                }
                state = State.SelectName;
                break;
            }

            case State.SelectName: {
                let cleanedUrl = imageUrl.startsWith('https://') ? imageUrl : `https://${imageUrl}`;
                if (cleanedUrl.lastIndexOf('/') > 0
                        && cleanedUrl.substring(cleanedUrl.lastIndexOf('/')).indexOf(':') >=0) {
                    // it has a version tag, which we need to clean for the
                    cleanedUrl = cleanedUrl.substring(0, cleanedUrl.lastIndexOf(':'));
                }
                const imageUrlAsUrl = new URL(cleanedUrl);
                const suggestedName = `my-${path.basename(imageUrlAsUrl.pathname)}`;

                const deploymentName = await Deployment.getDeploymentName(suggestedName, true);

                if (deploymentName === null) {
                    return;
                } else if (deploymentName === undefined) {
                    state = State.SelectImage;
                    break;
                }

                await Oc.Instance.createDeploymentFromImage(deploymentName, imageUrl);
                void window.showInformationMessage(`Created deployment '${deploymentName}' from image '${imageUrl}'`);
                OpenShiftExplorer.getInstance().refresh(context);

                void OpenShiftExplorer.watchLogs({
                    kind: 'Deployment',
                    metadata: {
                        name: deploymentName
                    }
                });

                return;
            }
            default:
            }

        }

    }

    @vsCommand('openshift.deployment.shell')
    static shellIntoDeployment(component: KubernetesObject): Promise<void> {
        void OpenShiftTerminalManager.getInstance().createTerminal(new CommandText('oc', `exec -it ${component.kind}/${component.metadata.name} -- /bin/sh`), `Shell to '${component.metadata.name}'`);
        return Promise.resolve();
    }

    /**
     * Prompt the user for the URL of a container image.
     *
     * @returns the selected container image URL, or undefined if "back" was requested, and null if "cancel" was requested
     */
    private static async getImageUrl(allowBack: boolean, initialValue?: string): Promise<string> {
        return new Promise<string | null | undefined>(resolve => {
            const disposables: Disposable[] = [];

            const cancelBtn = new quickBtn(new ThemeIcon('close'), 'Cancel');
            const okBtn = new quickBtn(new ThemeIcon('check'), 'Ok');

            const inputBox = window.createInputBox();
            inputBox.placeholder = 'docker.io/library/mongo';
            inputBox.title = 'Image URL';
            inputBox.value = initialValue;
            if (allowBack) {
                inputBox.buttons = [QuickInputButtons.Back, okBtn, cancelBtn];
            } else {
                inputBox.buttons = [okBtn, cancelBtn];
            }
            inputBox.ignoreFocusOut = true;

            disposables.push(inputBox.onDidHide(() => resolve(null)));

            disposables.push(inputBox.onDidChangeValue((e) => {
                if (validator.isURL(inputBox.value)) {
                    inputBox.validationMessage = undefined;
                } else {
                    inputBox.validationMessage = 'Please enter a valid URL';
                }
            }));

            disposables.push(inputBox.onDidAccept((e) => {
                if (inputBox.validationMessage === undefined && inputBox.value !== undefined) {
                    resolve(inputBox.value);
                    inputBox.hide();
                    disposables.forEach(disposable => {disposable.dispose()});
                }
            }));

            disposables.push(inputBox.onDidTriggerButton((button) => {
                if (button === QuickInputButtons.Back) {
                    inputBox.hide();
                    resolve(undefined);
                } else if (button === cancelBtn) {
                    inputBox.hide();
                    resolve(null);
                } else if (button === okBtn) {
                    if (inputBox.validationMessage === undefined && inputBox.value !== undefined) {
                        inputBox.hide();
                        resolve(inputBox.value);
                        disposables.forEach(disposable => {disposable.dispose()});
                    }
                }
            }));

            inputBox.show();
        });
    }

    /**
     * Prompt the user for the name of the deployment.
     *
     * @returns the selected deployment name, or undefined if "back" was requested, and null if "cancel" was requested
     */
    private static async getDeploymentName(suggestedName: string, allowBack: boolean): Promise<string> {
        return new Promise<string | null | undefined>(resolve => {
            const disposables: Disposable[] = [];

            const cancelBtn = new quickBtn(new ThemeIcon('close'), 'Cancel');
            const okBtn = new quickBtn(new ThemeIcon('check'), 'Ok');

            const inputBox = window.createInputBox();
            inputBox.placeholder = suggestedName;
            inputBox.value = suggestedName;
            inputBox.title = 'Deployment Name';
            if (allowBack) {
                inputBox.buttons = [QuickInputButtons.Back, okBtn, cancelBtn];
            } else {
                inputBox.buttons = [okBtn, cancelBtn];
            }
            inputBox.ignoreFocusOut = true;

            disposables.push(inputBox.onDidHide(() => resolve(null)));

            disposables.push(inputBox.onDidChangeValue((e) => {
                if (inputBox.value === undefined) {
                    inputBox.validationMessage = undefined;
                } else {
                    inputBox.validationMessage = validateRFC1123DNSLabel('Must be a valid Kubernetes name', inputBox.value);
                    if (inputBox.validationMessage.length === 0) {
                        inputBox.validationMessage = undefined;
                    }
                }
            }));

            disposables.push(inputBox.onDidAccept((e) => {
                if (inputBox.validationMessage === undefined && inputBox.value !== undefined) {
                    resolve(inputBox.value);
                    inputBox.hide();
                    disposables.forEach(disposable => {disposable.dispose()});
                }
            }));

            disposables.push(inputBox.onDidTriggerButton((button) => {
                if (button === QuickInputButtons.Back) {
                    inputBox.hide();
                    resolve(undefined);
                } else if (button === cancelBtn) {
                    inputBox.hide();
                    resolve(null);
                } else if (button === okBtn) {
                    if (inputBox.validationMessage === undefined && inputBox.value !== undefined) {
                        resolve(inputBox.value);
                        inputBox.hide();
                        disposables.forEach(disposable => {disposable.dispose()});
                    }
                }
            }));

            inputBox.show();
        });
    }

}
