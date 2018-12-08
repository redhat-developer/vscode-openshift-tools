/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import walker = require('walker');
import { WatchUtil } from '../src/util/watch';

walker('.').filterDir((dir) => dir !== 'node_modules' && dir !== '.vscode-test').on('file', async (file: string) => {
  if (file.endsWith('.ts')) {
    await WatchUtil.grep(file, /Copyright \(c\) Red Hat\, Inc\. All rights reserved/).catch((err) => console.log(file));
  }
});