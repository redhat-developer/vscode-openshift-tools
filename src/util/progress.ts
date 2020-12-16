/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class Progress {
    static async execFunctionWithProgress<R>(
        title: string,
        func: (progress: vscode.Progress<{ increment: number; message: string }>) => Promise<R>,
    ): Promise<R> {
        return vscode.window.withProgress(
            {
                cancellable: false,
                location: vscode.ProgressLocation.Notification,
                title,
            },
            func,
        );
    }
}
