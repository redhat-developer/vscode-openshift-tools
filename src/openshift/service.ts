/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { vsCommand } from '../vscommand';
import CreateServiceViewLoader from '../webview/create-service/createServiceViewLoader';

/**
 * Wraps commands that are used for interacting with services.
 */
export class Service {
    @vsCommand('openshift.service.create')
    static async createNewOperatorBackedService() {
        await CreateServiceViewLoader.loadView();
    }
}
