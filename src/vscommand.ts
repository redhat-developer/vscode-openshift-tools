/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-explicit-any */

import { commands, Disposable, window } from 'vscode';

type VsCommandFunction = (...args: any[]) => Promise<any> | any;

interface VsCommand {
    commandId: string;
    key: string;
    method: VsCommandFunction;
}

export class VsCommandError extends Error {
    constructor(message: string, public parent?: Error) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

const vsCommands: VsCommand[] = [];

function displayResult(result?: unknown): unknown {
    if (result && typeof result === 'string' && result.length > 0) {
        window.showInformationMessage(result);
    }
    return result;
}

async function execute(command: VsCommandFunction, ...params: any[]): Promise<unknown> {
    try {
        const res = command.call(null, ...params);
        return displayResult(await Promise.resolve(res));
    } catch (err) {
        if (err instanceof VsCommandError) {
            window.showErrorMessage(err.message);
        } else if (err instanceof Error) {
            window.showErrorMessage(err.toString());
        } else {
            window.showErrorMessage(err);
        }
        throw err;
    }
}

export async function registerCommands(...modules: string[]): Promise<Disposable[]> {
    // this step is required to get all annotations processed and this is drawback,
    // because it triggers javascript loading when extension is activated
    await Promise.all(modules.map((module) => import(module)));
    return vsCommands.map((cmd) => {
        return commands.registerCommand(cmd.commandId, (...params) =>
           execute(cmd.method, ...params)
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