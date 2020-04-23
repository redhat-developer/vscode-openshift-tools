/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { commands, Disposable, window } from 'vscode';

interface VsCommand {
    commandId: string;
    key: string;
    method: (...args: any[]) => Promise<any> | void;
}

const vsCommands: VsCommand[] = [];

function displayResult(result?: any): void {
    if (result && typeof result === 'string') {
        window.showInformationMessage(result);
    }
}

function execute<T>(
    command: (...args: T[]) => Promise<any> | void,
    ...params: T[]
): Promise<any> {
    try {
        const res = command.call(null, ...params);
        return res && res.then
            ? res
                  .then((result: any) => {
                      displayResult(result);
                  })
                  .catch((err: any) => {
                      window.showErrorMessage(err.message ? err.message : err);
                  })
            : undefined;
    } catch (err) {
        window.showErrorMessage(err);
    }
}

export async function registerCommands(...modules: string[]): Promise<Disposable[]> {
    await Promise.all(modules.map((module) => import(module)));
    return vsCommands.map((cmd) => {
        return commands.registerCommand(cmd.commandId, (...params) =>
            execute(cmd.method, ...params),
        );
    });
}

export function vsCommand(commandId: string, palette = false): Function {
    return (_target: any, key: string, descriptor: any): void => {
        if (!(typeof descriptor.value === 'function')) {
            throw new Error('not supported');
        }
        vsCommands.push({ commandId, key, method: descriptor.value });
        if (palette) {
            vsCommands.push({ commandId: `${commandId}.palette`, key, method: descriptor.value });
        }
    };
}
