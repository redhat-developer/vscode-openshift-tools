/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Odo, OdoImpl, OpenShiftObject } from '../odo';
import { OpenShiftExplorer } from '../explorer';

export abstract class OpenShiftItem {
    protected static readonly odo: Odo = OdoImpl.getInstance();
    protected static readonly explorer: OpenShiftExplorer = OpenShiftExplorer.getInstance();

    static create(context: OpenShiftObject): Promise<String> { return Promise.reject(); }
    static del(context: OpenShiftObject): Promise<String> { return Promise.reject(); }
    static wait(timeout: number = 2500): Promise<void> { return  new Promise((res)=>setTimeout(res, timeout)); }
}