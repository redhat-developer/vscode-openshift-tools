/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

const fs = require('fs-extra');

const readme = fs.readFileSync('./README.md');

const lines = `${readme}`.split('\n');

const index = lines.findIndex((line) => line.includes('## Overview'));
lines.splice(0, index + 1);
fs.writeFileSync('./README.md', lines.join('\n'));
