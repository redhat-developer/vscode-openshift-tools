/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Disposable } from 'vscode';
import { vsCommand } from '../vscommand';
import CreateRouteViewLoader from '../webview/create-route/createRouteViewLoader';

/**
 * Wraps commands that are used for interacting with routes.
 */
export class Route implements Disposable {
    private static instance: Route;

    public static getInstance(): Route {
        if (!Route.instance) {
            Route.instance = new Route();
        }
        return Route.instance;
    }

    dispose() { }

    @vsCommand('openshift.route.create')
    static async createNewRoute() {
        await CreateRouteViewLoader.loadView();
    }
}
