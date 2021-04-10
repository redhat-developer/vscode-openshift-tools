/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-explicit-any */

import { commands, Disposable, window } from 'vscode';
import * as stackTraceParser from 'stacktrace-parser';
import sendTelemetry from './telemetry';
import { ExtenisonID } from './util/constants';

type VsCommandFunction = (...args: any[]) => Promise<any> | any;

interface VsCommand {
    commandId: string;
    key: string;
    method: VsCommandFunction;
}

export class VsCommandError extends Error {
    constructor(message: string, public readonly telemetryMessage = message, public parent?: Error) {
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
            let stackTrace = {};
            try {
                result = await Promise.resolve(cmd.method.call(null, ...params));
                displayResult(result);
            } catch (err) {
                if (err.stack) {
                    const stack = stackTraceParser.parse(err.stack); // TODO: add recursive stacktrace parsing for parent errors
                    if (stack.length > 0) {
                        const files = stack.map((value) => `${value.file.substring(value.file.lastIndexOf(ExtenisonID)-1)}:${value.lineNumber}:${value.column}`);
                        stackTrace = {
                            'stack_trace': files.join('\n')
                        };
                    }
                }
                if (err instanceof VsCommandError) {
                    // exception thrown by extension command with meaningful message
                    // just show it and return
                    telemetryProps.error = err.telemetryMessage;
                    window.showErrorMessage(err.message);
                } else {
                    // Unexpected exception happened. Let vscode handle the error reporting.
                    // This does not work when command started by pressing button in view title
                    // TODO: Wrap view title commands in try/catch and re-throw as VsCommandError
                    // TODO: telemetry cannot send not known exception stacktrace or message
                    // because it can contain user's sensitive information
                    if (err instanceof TypeError) {
                        telemetryProps.error = err.message;
                    } else {
                        telemetryProps.error = 'Unexpected error';
                    }
                    window.showErrorMessage(err.toString());
                }
            } finally {
                telemetryProps.duration = Date.now() - startTime;
                telemetryProps.cancelled = result === null;
                if (result?.properties) {
                    telemetryProps = {...telemetryProps, ...result.properties};
                }
                telemetryProps = {...telemetryProps, ...stackTrace };
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
