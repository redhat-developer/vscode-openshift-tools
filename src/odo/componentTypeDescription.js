"use strict";
/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
exports.__esModule = true;
exports.isStarterProject = void 0;
;
function isStarterProject(prj) {
    return prj.name && (prj.git || prj.zip);
}
exports.isStarterProject = isStarterProject;
