/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/**
 * Validation status
 */
export enum ValidationStatus {
    ok='OK',
    warning='WARNING',
    error='ERROR'
}

/**
 * Represents a vallidation result with a status and validation message
 */
export type ValidationResult = {
    /**
     * Validation statis: ok/error/warning
     */
    status: ValidationStatus;

    /**
     * A message explaining the status value
     */
    message: string;
};
