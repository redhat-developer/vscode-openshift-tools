/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window, Terminal, TerminalOptions, EventEmitter, Pseudoterminal, ExtensionTerminalOptions } from 'vscode';

export class WindowUtil {
    static createTerminal(name: string, cwd?: string): Terminal {
        const options: TerminalOptions = {
            cwd,
            name,
            shellPath: process.platform === 'win32' ? process.env.ComSpec : '/bin/bash',
        };
        return window.createTerminal(options);
    }

    static createPseudoTerminal(name: string): Terminal {
        const writeEmitter = new EventEmitter<string>();
        const pty: Pseudoterminal = {
            onDidWrite: writeEmitter.event,
            open: () => {},
            close: () => {},
            handleInput: data => writeEmitter.fire(`${data}\r\n`)
        };
        const options: ExtensionTerminalOptions = {
            name,
            pty
        };
        return window.createTerminal(options);
    }
}
