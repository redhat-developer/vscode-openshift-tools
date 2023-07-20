/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window, Terminal, TerminalOptions } from 'vscode';

export class WindowUtil {
    static createTerminal(name: string, cwd?: string, env = process.env): Terminal {

        const options: TerminalOptions = {
            cwd,
            name,
            env
        };
        if (process.platform === 'win32') {
            options.shellPath = process.env.ComSpec;
        }
        return window.createTerminal(options);
    }
}
