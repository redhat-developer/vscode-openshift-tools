/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

// eslint-disable-next-line import/no-extraneous-dependencies
const downloadAndUnzipVSCode = require('vscode-test').downloadAndUnzipVSCode;
const [, , version] = process.argv;
downloadAndUnzipVSCode(version);