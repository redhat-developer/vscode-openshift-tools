/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import { window, Terminal, TerminalOptions } from 'vscode';
import * as path from 'path';

export class WindowUtil {

    static createTerminal(name: string, cwd: string, toolLocation?: string, env: NodeJS.ProcessEnv = process.env): Terminal {
        const finalEnv: NodeJS.ProcessEnv = {};
        Object.assign(finalEnv, env);
        const key = process.platform === 'win32' ? 'Path' : 'PATH';

        if (toolLocation && env[key] && !env[key].includes(toolLocation)) {
            finalEnv[key] = `${toolLocation}${path.delimiter}${env[key]}`;
        }
        const options: TerminalOptions = {
            cwd: cwd,
            name: name,
            env: finalEnv,
            shellPath: process.platform === 'win32' ? undefined : '/bin/bash'
        };
        return window.createTerminal(options);
    }
}