/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

export enum ContextType {
    CLUSTER = 'cluster',
    PROJECT = 'project',
    APPLICATION = 'application',
    COMPONENT = 'component_not_pushed',
    COMPONENT_PUSHED = 'component',
    COMPONENT_NO_CONTEXT = 'component_no_context',
    SERVICE = 'service',
    STORAGE = 'storage',
    CLUSTER_DOWN = 'cluster_down',
    LOGIN_REQUIRED = 'login_required',
    COMPONENT_ROUTE = 'component_route'
}

export enum GlyphChars {
    Asterisk = '\u2217',
    Check = '\u2713',
    Space = '\u00a0',
    Push = '\u25C9',
    NotPushed = '\u25CE',
    NoContext = '\u2718'

}