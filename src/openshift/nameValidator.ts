/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import validator from 'validator';

export function emptyName(message: string, value: string): string | null {
    return validator.isEmpty(value) ? message : null;
}

export function lengthName(message: string, value: string, offset: number, minVal = 2, maxVal = 63): string | null {
    return validator.isLength(value, { min: minVal, max: maxVal - offset }) ? null : message;
}

export function validateUrl(message: string, value: string): string | null {
    return validator.isURL(value) ? null : message;
}

export function validateMatches(message: string, value: string): string | null {
    return validator.matches(value, '^[a-z]([-a-z0-9]*[a-z0-9])*$') ? null : message;
}

export function validatePath(message: string, value: string): string | null {
    const pathRegx = value.match(/^(\/{1}(?!\/))[A-Za-z0-9/\-_]*(([a-zA-Z]+))?$/);
    return pathRegx ? null : message;
}

export function validateFilePath(message: string, value: string): string | null {
    const proposedPath = path.parse(value);
    return /^devfile\.ya?ml$/i.test(proposedPath.base) ? null : message;
}

export function validateRFC1123DNSLabel(message: string, value: string): string | null {
  return validator.matches(value, '^[a-z0-9]([-a-z0-9]*[a-z0-9])*$') ? null : message;
}

export function clusterURL(value: string): string | null {
    const urlRegex = value.match(/--server=(https?:\/\/[^ ]*)/);
    return urlRegex ? urlRegex[1] : null;
}

export function getToken(value: string): string | null {
    const tokenRegex = value.match(/--token\s*=\s*(\S*).*/);
    return tokenRegex ? tokenRegex[1] : null;
}

export function ocLoginCommandMatches(value: string): string | null {
    return clusterURL(value) !== null && getToken(value) !== null ? value : null;
}
