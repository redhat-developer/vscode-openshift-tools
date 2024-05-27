/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { vsCommand } from '../vscommand';
import CreateRouteViewLoader from '../webview/create-route/createRouteViewLoader';

/**
 * Wraps commands that are used for interacting with routes.
 */
export class Route {
    @vsCommand('openshift.route.create')
    static async createNewRoute() {
        await CreateRouteViewLoader.loadView();
    }
}
