/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

 'use strict';

import * as vscode from 'vscode';
import * as odoctl from '../odo';
import { CliExitData } from '../cli';
import { ExecException } from 'child_process';

export interface Step {
    command: string;
    increment: number;
    total?: number;
}

export class Progress {
    static execWithProgress(options, steps: Step[], odo: odoctl.Odo): Thenable<void> {
        return vscode.window.withProgress(options,
        (progress: vscode.Progress<{increment: number, message: string}>, token: vscode.CancellationToken) => {
            const calls: (()=>Promise<any>)[] = [];
            steps.reduce((previous: Step, current: Step, currentIndex: number, steps: Step[])=> {
                current.total = previous.total + current.increment;
                calls.push(()=> {
                    return new Promise<CliExitData>(async (resolve,reject) => {
                        progress.report({
                            increment: previous.increment,
                            message: `${previous.total}%`
                        });

                            const result: CliExitData = await odo.execute(current.command);
                            if(result.error) {
                                reject(result.error);
                            } else {
                                if (currentIndex+1 === steps.length) {
                                    progress.report({
                                        increment: current.increment,
                                        message: `${current.total}%`
                                    });
                                }
                                resolve();
                            }
                    });
                });
                return current;
            }, {increment: 0, command: "", total: 0});

            return calls.reduce<Promise<any>>((previous: Promise<any>, current: ()=>Promise<any>, index: number, calls: (()=>Promise<any>)[])=> {
                return previous.then(current);
            }, Promise.resolve());
        });
    }
}