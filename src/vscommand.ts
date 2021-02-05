/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-explicit-any */

import { commands, Disposable, window } from 'vscode';
import sendTelemetry from './telemetry';

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
        const resPromise = command.call(null, ...params);
        return displayResult(await Promise.resolve(resPromise));
    } catch (err) {
        if (err instanceof VsCommandError) {
            // exception thrown by extension command with meaningful message
            // just show it and return
            window.showErrorMessage(err.message);
        } else {
            // Unexpected exception happened. Let vscode handle the error reporting.
            // This does not work when command started by pressing button in view title
            // TODO: Wrap view title commands in try/catch and re-throw as VsCommandError
            throw err;
        }
    }
}

export async function registerCommands(...modules: string[]): Promise<Disposable[]> {
    // this step is required to get all annotations processed and this is drawback,
    // because it triggers javascript loading when extension is activated
    await Promise.all(modules.map((module) => import(module)));
    return vsCommands.map((cmd) => {
        return commands.registerCommand(cmd.commandId, async (...params) => {
            let telemetryProps: any = {
                identifier: cmd.commandId,
            };
            let result: any;
            const startTime = Date.now();
            try {
                result =  await execute(cmd.method, ...params);
            } catch (err) {
                telemetryProps.error = err.toString();
                throw err;
            } finally {
                telemetryProps.duration = Date.now() - startTime;
                if (result?.properties) {
                    telemetryProps = {...telemetryProps, ...result.properties };
                }
                sendTelemetry('command', telemetryProps);
            }
        });
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