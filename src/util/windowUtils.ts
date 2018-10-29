/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import { window, Terminal, TerminalOptions } from 'vscode';
import * as path from 'path';
import { Platform } from './platform';

export class WindowUtil {
    private static readonly toolsLocation: string = path.resolve(Platform.getUserHomePath(), '.vs-openshift');

    static createTerminal(name: string, cwd: string, env: NodeJS.ProcessEnv = process.env): Terminal {
        const finalEnv: NodeJS.ProcessEnv = {};
        Object.assign(finalEnv, env);
        const key = process.platform === 'win32' ? 'Path' : 'PATH';
        finalEnv[key] = `${this.toolsLocation}${path.delimiter}${env[key]}`;

        const options: TerminalOptions = {
            cwd: cwd,
            name: name,
            env: finalEnv,
            shellPath: process.platform === 'win32' ? undefined : '/bin/bash'
        };
        return window.createTerminal(options);
    }
}