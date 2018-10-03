/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as odoctl from './odo';

export interface Step {
    command: string;
    increment: number;
    total?: number;
}

export function execWithProgress(options, steps: Step[], odo: odoctl.Odo): Thenable<void> {

    return vscode.window.withProgress(options ,
    (progress: vscode.Progress<{increment: number, message: string}>, token: vscode.CancellationToken) => {
        const calls: (()=>Promise<any>)[] = [];
        steps.reduce((previous: Step, current: Step, currentIndex: number, steps: Step[])=> {
            calls.push(()=> {
                let result: Promise<any> = Promise.resolve();
                progress.report({
                    increment: previous.increment,
                    message: `${previous.total}%`
                });
                result = odo.execute(current.command);
                current.total = previous.total + current.increment;
                return currentIndex+1 === steps.length ? result.then(()=> {
                    progress.report({
                        increment: previous.increment,
                        message: `${previous.total}%`
                    });
                }) : result;
            });
            return current;
        }, {increment: 0, command: "", total: 0});

        return calls.reduce<Promise<any>>((previous: Promise<any>, current: ()=>Promise<any>, index: number, calls: (()=>Promise<any>)[])=> {
            return previous.then(current);
        }, Promise.resolve()).catch((error) => vscode.window.showErrorMessage(`${error}`));
    });
}