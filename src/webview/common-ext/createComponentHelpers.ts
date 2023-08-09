/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as fs from 'fs/promises';
import * as path from 'path';
import * as YAML from 'yaml';
import { Registry } from '../../odo/componentType';
import OpenShiftItem from '../../openshift/openshiftItem';
import { ComponentTypesView } from '../../registriesView';
import { Devfile, DevfileRegistry } from '../common/devfile';

/**
 * Represents if something if valid, and if not, why
 */
type ValidationResult = {
    /**
     * True if the project folder is valid and false otherwise
     */
    valid: boolean;

    /**
     * A message explaining why the project folder is invalid,
     * or providing further information in the case that the project folder is valid
     */
    message: string;
};

/**
 * Returns a ValidationResult indicating whether the project folder is valid.
 *
 * @param folder the parent folder
 * @param componentName the name of the component, which will be used for the child folder
 * @returns a ValidationResult indicating whether the project folder is valid.
 */
export async function isValidProjectFolder(
    folder: string,
    componentName: string,
): Promise<ValidationResult> {
    let projectFolderExists = false;
    try {
        const stats = await fs.stat(folder);
        projectFolderExists = stats.isDirectory();
    } catch (_) {
        // do nothing
    }

    let projectFolderWritable = false;
    if (projectFolderExists) {
        try {
            await fs.access(folder, fs.constants.W_OK);
            projectFolderWritable = true;
        } catch (_) {
            // do nothing
        }
    }

    const childFolder = path.join(folder, componentName);
    let childFolderExists = false;
    if (projectFolderExists && projectFolderWritable) {
        try {
            await fs.access(childFolder);
            childFolderExists = true;
        } catch (_) {
            // do nothing
        }
    }

    let validationMessage: string = undefined;
    if (!projectFolderExists) {
        validationMessage = `Project folder ${folder} doesn't exist`;
    } else if (!projectFolderWritable) {
        validationMessage = `Project folder ${folder} is not writable`;
    } else if (childFolderExists) {
        validationMessage = `There is already a folder ${componentName} in ${folder}`;
    } else {
        validationMessage = `Project will be created in ${childFolder}`;
    }

    return {
        valid: projectFolderExists && projectFolderWritable && !childFolderExists,
        message: validationMessage,
    };
}

/**
 * Returns the validation message if the component name is invalid, and undefined otherwise.
 *
 * @param name the component name to validate
 * @returns the validation message if the component name is invalid, and undefined otherwise
 */
export function validateComponentName(name: string): string {
    let validationMessage = OpenShiftItem.emptyName('Please enter a component name.', name);
    if (!validationMessage) {
        validationMessage = OpenShiftItem.validateMatches(
            `Not a valid component name.
        Please use lower case alphanumeric characters or '-', start with an alphabetic character, and end with an alphanumeric character`,
            name,
        );
    }
    if (!validationMessage) {
        validationMessage = OpenShiftItem.lengthName(
            'Component name should be between 2-63 characters',
            name,
            0,
        );
    }
    return validationMessage;
}

/**
 * Returns a list of the devfile registries with their devfiles attached.
 *
 * @returns a list of the devfile registries with their devfiles attached
 */
export function getDevfileRegistries(): DevfileRegistry[] {
    const registries = ComponentTypesView.instance.getListOfRegistries();
    if (!registries || registries.length === 0) {
        throw new Error('No Devfile registries available. Default registry is missing');
    }
    const devfileRegistries = registries.map((registry: Registry) => {
        return {
            devfiles: [],
            name: registry.name,
            url: registry.url,
        } as DevfileRegistry;
    });

    const components = ComponentTypesView.instance.getCompDescriptions();
    for (const component of components) {
        const devfileRegistry = devfileRegistries.find(
            (devfileRegistry) => devfileRegistry.url === component.registry.url.toString(),
        );

        devfileRegistry.devfiles.push({
            description: component.description,
            registryName: devfileRegistry.name,
            logoUrl: component.devfileData.devfile.metadata.icon,
            name: component.displayName,
            id: component.name,
            starterProjects: component.devfileData.devfile.starterProjects,
            tags: component.tags,
            yaml: YAML.stringify(component.devfileData.devfile),
            supportsDebug:
                Boolean(
                    component.devfileData.devfile.commands?.find(
                        (command) => command.exec?.group?.kind === 'debug',
                    ),
                ) ||
                Boolean(
                    component.devfileData.devfile.commands?.find(
                        (command) => command.composite?.group?.kind === 'debug',
                    ),
                ),
            supportsDeploy:
                Boolean(
                    component.devfileData.devfile.commands?.find(
                        (command) => command.exec?.group?.kind === 'deploy',
                    ),
                ) ||
                Boolean(
                    component.devfileData.devfile.commands?.find(
                        (command) => command.composite?.group?.kind === 'deploy',
                    ),
                ),
        } as Devfile);
    }
    devfileRegistries.sort((a, b) => (a.name < b.name ? -1 : 1));
    return devfileRegistries;
}
