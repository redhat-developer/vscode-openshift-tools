/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as fs from 'fs/promises';
import * as path from 'path';
import { WebviewPanel } from 'vscode';
import { DevfileInfo } from '../../devfile-registry/devfileInfo';
import { DevfileRegistry } from '../../devfile-registry/devfileRegistryWrapper';
import { Registry } from '../../odo/componentType';
import * as NameValidator from '../../openshift/nameValidator';
import { ValidationResult, ValidationStatus } from '../common/validationResult';

/**
 * Returns a ValidationResult indicating whether the project folder is valid.
 *
 * @param folder the parent folder
 * @param componentName the name of the component, which will be used for the child folder
 * @returns a ValidationResult indicating whether the project folder is valid.
 */
export async function isValidProjectFolder(
    folder: string,
    componentName: string
): Promise<ValidationResult> {
    if (!folder) { // Folder cannot be Undefined
        return {
            status: ValidationStatus.error,
            message: 'Please specify a valid folder path'
        };
    }

    let projectFolderExists = false;
    try {
        const stats = await fs.stat(folder);
        projectFolderExists = stats.isDirectory();
    } catch {
        // do nothing
    }

    let projectFolderWritable = false;
    if (projectFolderExists) {
        try {
            await fs.access(folder, fs.constants.W_OK);
            projectFolderWritable = true;
        } catch {
            // do nothing
        }
    }

    const childFolder = path.join(folder, componentName);
    let childFolderExists = false;
    if (projectFolderExists && projectFolderWritable) {
        try {
            await fs.access(childFolder);
            childFolderExists = true;
        } catch {
            // do nothing
        }
    }

    let validationMessage: string = undefined;
    let validationStatus: ValidationStatus = ValidationStatus.ok;
    if (!projectFolderExists) {
        if (await canRecursivelyCreateProjectFolder(folder)) {
            validationStatus = ValidationStatus.warning;
            validationMessage = `Project can be created in ${childFolder}`;
        } else {
            validationStatus = ValidationStatus.error;
            validationMessage = `Project folder ${folder} doesn't exist`;
        }
    } else if (!projectFolderWritable) {
        validationStatus = ValidationStatus.error;
        validationMessage = `Project folder ${folder} is not writable`;
    } else if (childFolderExists) {
        validationStatus = ValidationStatus.error;
        validationMessage = `There is already a folder ${componentName} in ${folder}`;
    } else {
        validationMessage = `Project will be created in ${childFolder}`;
    }

    return { status: validationStatus, message: validationMessage };
}

/**
 * Checks if project folder can be created, in case it doesn't exit.
 * In case of non-existing project folder - it is required tthat it can be created,
 * so it's nearest existing parent folder should be writable
 *
 * @param folder Expected (non-existing) project folder
 * @returns true if there is an existing and writable parent folder. false otherwise.
 */
async function canRecursivelyCreateProjectFolder(
    folder: string
): Promise<boolean> {
    if (!folder) return false; // Parent doesn't exist

    const folderPath = path.parse(folder);
    const root = folderPath.root;

    // Reconstruct the folder to avoid having `/` (or `\` on Windows) at the end
    let parentFolder: string = path.join(folderPath.dir, folderPath.base).toString();
    let parentFolderExists = false;
    while (parentFolder !== root && !parentFolderExists) {
        parentFolderExists = false;
        try {
            const stats = await fs.stat(parentFolder);
            parentFolderExists = stats.isDirectory();
            if (!parentFolderExists) {
                return false; // Parent exists, but not a directory
            }
        } catch {
            // do nothing
        }

        if (parentFolderExists) {
            try {
                await fs.access(parentFolder, fs.constants.W_OK);
                return true; // Parent exists and is writable
            } catch {
                return false; // Parent folder exists, but isn;t writable
            }
        }
        parentFolder = path.parse(parentFolder).dir;
    }

    return false; // Parent folder doesn't exist
}

/**
 * Returns the validation message if the component name is invalid, and undefined otherwise.
 *
 * @param name the component name to validate
 * @param isComponentBasedValidation component based validation or not
 * @returns the validation message if the component name is invalid, and undefined otherwise
 */
export function validateName(name: string, isComponentBasedValidation = true): string {
    let validationMessage = NameValidator.emptyName(`Please enter a ${isComponentBasedValidation ? 'component' : ''} name.`, name);
    if (!validationMessage) {
        validationMessage = NameValidator.validateMatches(
            `Not a valid ${isComponentBasedValidation ? 'component' : ''} name.
        Please use lower case alphanumeric characters or '-', start with an alphabetic character, and end with an alphanumeric character`,
            name,
        );
    }
    if (!validationMessage) {
        validationMessage = NameValidator.lengthName(
            `${isComponentBasedValidation ? 'Component name' : 'Name'} should be between 2-63 characters`,
            name,
            0,
        );
    }
    return validationMessage;
}

/**
 * Returns the validation message if the component name is invalid, and undefined otherwise.
 *
 * @param portNumber the port number to validate
 * @returns the validation message if the component name is invalid, and undefined otherwise
 */
export function validatePortNumber(portNumber: number): string {
    let validationMessage: string | null;
    const port = portNumber.toString();
    if (NameValidator.emptyName('Empty', port) === null) {
        validationMessage = NameValidator.lengthName(
            'Port number length should be between 1-5 digits',
            port,
            0,
            1,
            5
        );

        if (!validationMessage) {
            if (portNumber < 1 || portNumber > 65535) {
                validationMessage = 'Not a valid port number.'
            }
        }
    }
    return validationMessage;
}

/**
 * Returns a list of possible the devfile capabilities.
 *
 * Currently the capabilities are predefined and include:
 * - Debug Support
 * - Deploy Support
 *
 * @returns a list of the devfile capabilities
 */
export function getDevfileCapabilities(): string[] {
    return ['Debug', 'Deploy'];
}

/**
 * Returns a list of the devfile tags found in devfiles registries.
 *
 * @returns a list of the devfile tags
 */
export async function getDevfileTags(registryUrl?: string): Promise<string[]> {
    const devfileRegistries = await DevfileRegistry.Instance.getRegistryDevfileInfos(registryUrl);

    const devfileTags: string[] = [
        ...new Set(
            devfileRegistries
                .filter((devfileRegistry) => registryUrl ? devfileRegistry.registry.url === registryUrl : true)
                .flatMap((_devfile) => _devfile.tags))
    ]
    return devfileTags.filter((devfileTag) => !devfileTag.toLowerCase().includes('deprecate'));
}

export async function sendUpdatedRegistries(panel: WebviewPanel, registryUrl?: string): Promise<Registry[]> {
    if (panel) {
        const registries = await DevfileRegistry.Instance.getRegistries(registryUrl)
        void panel.webview.postMessage({
            action: 'devfileRegistries',
            data: registries,
        });
        return registries;
    }
    return undefined;
}

export function sendUpdatedCapabilities(panel: WebviewPanel) {
    if (panel) {
        void panel.webview.postMessage({
            action: 'devfileCapabilities',
            data: getDevfileCapabilities(),
        });
    }
}

export async function sendUpdatedTags(panel: WebviewPanel, registryUrl?: string) {
    if (panel) {
        void panel.webview.postMessage({
            action: 'devfileTags',
            data: await getDevfileTags(registryUrl),
        });
    }
}

export async function sendUpdatedDevfileInfos(panel: WebviewPanel, registryUrl?: string) {
    if (panel) {
        const devfileInfos = await DevfileRegistry.Instance.getRegistryDevfileInfos(registryUrl);
        void panel.webview.postMessage({
            action: 'devfileInfos',
            data: devfileInfos,
        });
    }
}

export async function sendDevfileForVersion(panel: WebviewPanel, devfileInfo?: DevfileInfo, version?: string) {
    if (panel && devfileInfo) {
        const devfile = await DevfileRegistry.Instance.getRegistryDevfile(devfileInfo.registry.url, devfileInfo.name, version);
        void panel.webview.postMessage({
            action: 'devfile',
            data: devfile
        });
    }
}