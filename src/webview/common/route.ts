/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat; Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export type RouteInputBoxText = {

    name: string;
    error: boolean;
    helpText: string;
}

export type CreateRoute = {
    routeName: string;
    hostname: string;
    path: string;
    serviceName: string;
    port: {
        number: string;
        name: string;
        protocal: string
    };
    isSecured: boolean;
}
