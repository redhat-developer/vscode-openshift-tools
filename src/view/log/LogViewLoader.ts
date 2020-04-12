/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';

export default class LogViewLoader {
    static loadView(extensionPath: string, title: string): vscode.WebviewPanel {
        const localResourceRoot = vscode.Uri.file(path.join(extensionPath, 'out', 'logViewer'));

        const panel = vscode.window.createWebviewPanel('logView', title, vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [localResourceRoot],
            retainContextWhenHidden: true
        });

        // TODO: When webview is going to be ready?
        panel.webview.html = LogViewLoader.getWebviewContent(extensionPath);
        return panel;
    }

    private static getWebviewContent(extensionPath: string): string {
        // Local path to main script run in the webview
        const reactAppPathOnDisk = vscode.Uri.file(
            path.join(extensionPath, 'out', 'logViewer', 'logViewer.js'),
        );
        const reactAppUri = reactAppPathOnDisk.with({ scheme: 'vscode-resource' });

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Config View</title>
            <meta http-equiv="Content-Security-Policy"
                        content="connect-src *;
                                default-src 'none';
                                img-src https:;
                                script-src 'unsafe-eval' 'unsafe-inline' vscode-resource:;
                                style-src vscode-resource: 'unsafe-inline';">
            <script>
            window.acquireVsCodeApi = acquireVsCodeApi;
            </script>
            <style>
                html,
                body {
                padding: 0;
                overflow: hidden;
                }

                .box {
                    display: flex;
                    flex-flow: column;
                    position: absolute;
                    top: 0px;
                    bottom: 1px;
                    left: 0px;
                    right: 0px;
                }

                .box .row.header {
                    flex: 0 1 auto;
                    /* The above is shorthand for:
                    flex-grow: 0,
                    flex-shrink: 1,
                    flex-basis: auto
                    */
                }

                .box .row.content {
                    flex: 1 1 auto;
                }
            </style>
        </head>
        <div class="box">
            <div class="row header" id="spinner">
            </div>
            <div class="row content" id="root">
            </div>
        </div>
        <script src="${reactAppUri}"></script>
      </body>
    </html>`;
    }
}
