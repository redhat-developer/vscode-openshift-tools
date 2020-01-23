/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { WatchUtil } from '../src/util/watch';

'use strict';

import walker = require('walker');

let failed = false;
walker('.').filterDir((dir: string) => dir !== 'node_modules' && dir !== '.vscode-test').on('file', async (file: string) => {
  if (file.endsWith('.ts')) {
    const result = await WatchUtil.grep(file, /Copyright \(c\)/);
    if (!result) {
      if (!failed) {
        failed = true;
        console.log('Files without copyright comment:');
      }
      console.log(`- ${  file}`);
    }
  }
}).on('end', () => {
  if (failed) throw Error('Found files without copyright comment.');
});