/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export interface Step {
    command: string;
    increment: number;
    total?: number;
}

export class Progress {

  static async execFunctionWithProgress(title: string, func: (progress: vscode.Progress<{increment: number; message: string}>) => Promise<any> ): Promise<string> {
        return new Promise((resolve, reject) => {
            vscode.window.withProgress({
                    cancellable: false,
                    location: vscode.ProgressLocation.Notification,
                    title
                },
                async (progress: vscode.Progress<{increment: number; message: string}>) => {
                    await func(progress).then(resolve).catch(reject);
                }
            );
        });
    }
}
