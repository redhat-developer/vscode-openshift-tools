/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
'use strict';

export function isThenable<T>(candidate: any): candidate is Thenable<T> {
    return candidate && typeof (<Thenable<any>>candidate).then === 'function';
}

export function wait(timeout: number = 2500): Promise<void> {
    return new Promise((res) => setTimeout(res, timeout));
}