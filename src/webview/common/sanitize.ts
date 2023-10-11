/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/**
 * Builds a sanitized compponent name from a component folder full path or
 * a Git-repo URL
 *
 * @param pathOrURL an absolute path ot a Git-repo URL
 * @returns sanitized component name
 */
export function buildSanitizedComponentName(pathOrURL?: string): string {
    let folder: string = pathOrURL ? pathOrURL : '';
    folder = folder.endsWith('.git') ? folder.substring(0, folder.lastIndexOf('.git')) : folder;
    const isWindowsPath = folder.length > 1 && folder.charAt(1) === ':';
    const componentNameFromFolder = folder //
        .substring(folder.lastIndexOf(isWindowsPath ? '\\' : '/') + 1)
        .toLocaleLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/[-.]+$/, '')
        .replace(/^[-.0-9]+/, '');
    return componentNameFromFolder.length ? componentNameFromFolder : 'component';
}