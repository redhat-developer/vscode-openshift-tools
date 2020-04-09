/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from "vscode";
import * as path from "path";

export default class ViewLoader {
  private readonly _panel: vscode.WebviewPanel | undefined;
  private readonly _extensionPath: string;
  private _disposables: vscode.Disposable[] = [];

  constructor(extensionPath: string, title: string) {
    this._extensionPath = extensionPath;

    this._panel = vscode.window.createWebviewPanel(
        "configView",
        title,
        vscode.ViewColumn.One,
        {
          enableScripts: true,

          localResourceRoots: [
            vscode.Uri.file(path.join(extensionPath, 'out', "logViewer"))
          ]
        }
      );

      this._panel.webview.html = this.getWebviewContent();

      this._panel.webview.onDidReceiveMessage(
        (command: {action: string, message: string}) => {
          switch (command.action) {
            case 'info':
              vscode.window.showInformationMessage(command.message);
              return;
            default:
                return;
          }
        },
        undefined,
        this._disposables
      );
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    postMessage(arg0: { action: string; message: string; }) {
        this._panel.webview.postMessage(arg0);
    }

  private getWebviewContent(): string {
    // Local path to main script run in the webview
    const reactAppPathOnDisk = vscode.Uri.file(
      path.join(this._extensionPath, 'out', 'logViewer', 'logViewer.js')
    );
    const reactAppUri = reactAppPathOnDisk.with({ scheme: "vscode-resource" });

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Config View</title>
        <meta http-equiv="Content-Security-Policy"
                    content="default-src 'none';
                             img-src https:;
                             script-src 'unsafe-eval' 'unsafe-inline' vscode-resource:;
                             style-src vscode-resource: 'unsafe-inline';">
        <script>
          window.acquireVsCodeApi = acquireVsCodeApi;
        </script>
    </head>
    <body>
        <div id="root"></div>
        <script src="${reactAppUri}"></script>
    </body>
    </html>`;
  }
}