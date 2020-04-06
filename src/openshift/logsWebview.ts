/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { WebPanel } from '../util/webpanel';
import { OdoImpl, Odo } from "../odo";

export class LogsPanel extends WebPanel {
    public extensionContext: vscode.ExtensionContext;
    public static readonly viewType = 'openshiftLogs';
    public static currentPanels = new Map<string, LogsPanel>();
    protected static readonly odo: Odo = OdoImpl.Instance;

    public static createOrShow(content: string, resource: string): LogsPanel {
        // eslint-disable-next-line no-shadow
        const fn = (panel: vscode.WebviewPanel, content: string, resource: string): LogsPanel => {
            return new LogsPanel(panel, content, resource);
        };

        return WebPanel.createOrShowInternal<LogsPanel>(content, resource, LogsPanel.viewType, "OpenShift Logs", LogsPanel.currentPanels, fn);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        content: string,
        resource: string,
    ) {
        super(panel, content, resource, LogsPanel.currentPanels);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    public addContent(content: string) {
        this.content += content;
        if (this.canProcessMessages) {
            this.panel.webview.postMessage({
                command: 'content',
                text: content,
            });
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    protected update() {
        this.panel.title = `Logs - ${this.resource}`;
        this.panel.webview.html = this.getHtmlForWebview();
    }

    private getHtmlForWebview(): string {
		return `<!doctype html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>OpenShift logs ${this.resource}</title>
        </head>
        <body>
            <div style='position: fixed; top: 15px; left: 2%; width: 100%'>
                <span style='position: absolute; left: 0%'>Show log entries</span>
                <select id='mode' style='margin-bottom: 5px; position: absolute; left: 110px' onchange='eval()'>
                    <option value='all'>all</option>
                    <option value='include'>that match</option>
                    <option value='exclude'>that don't match</option>
                    <option value='after'>after match</option>
                    <option value='before'>before match</option>
                </select>
                <span style='position: absolute; left: 240px'>Match expression</span>
                <input style='left:350px; position: absolute' type='text' id='regexp' onkeyup='eval()' placeholder='Filter' size='25'/>
            </div>
            <div style='position: absolute; top: 55px; bottom: 10px; width: 97%'>
              <div style="overflow-y: scroll; height: 100%">
                  <code>
                    <pre id='content'>
                    </pre>
                  </code>
                </div>
            </div>
            <script>
              var lastMode = '';
              var lastRegexp = '';
              var renderNonce = 0;
              var orig = \`${this.content}\`.split('\\n');
              window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'content':
                    const elt = document.getElementById('content');
                    const text = message.text.split('\\n');
                    text.forEach((line) => {
                        if (line.trim() != "" && line.length > 0) {
                            orig.push(line);
                        }
                    });
                    // TODO: need to apply filters here!
                    elt.appendChild(document.createTextNode(message.text));
                }
              });
              var eval = () => {
                setTimeout(evalInternal, 0);
              };
              var evalInternal = () => {
                // We use this to abort renders in progress if a new render starts
                renderNonce = Math.random();
                var currentNonce = renderNonce;
                var regexp = document.getElementById('regexp').value;
                var mode = document.getElementById('mode').value;
                if (lastMode == mode && lastRegexp == regexp) {
                    return;
                }
                lastRegexp = regexp;
                lastMode = mode;
                if (regexp.length > 0) {
                    var regex = new RegExp(regexp);
                    switch (mode) {
                        case 'all':
                            content = orig;
                            break;
                        case 'include':
                            content = orig.filter((line) => regex.test(line));
                            break;
                        case 'exclude':
                            content = orig.filter((line) => !regex.test(line));
                            break;
                        case 'before':
                            content = [];
                            for (const line of orig) {
                                if (regex.test(line)) {
                                    break;
                                }
                                content.push(line);
                            }
                            break;
                        case 'after':
                            const i = orig.findIndex((line) => {
                                return regex.test(line)
                            });
                            content = orig.slice(i+1);
                            break;
                    }
                } else {
                    content = orig;
                }
                var elt = document.getElementById('content');
                elt.textContent = '';
                // This is probably seems more complicated than necessary.
                // However, rendering large blocks of text are _slow_ and kill the UI thread.
                // So we split it up into manageable chunks to keep the UX lively.
                // Of course the trouble is then we could interleave multiple different filters.
                // So we use the random nonce to detect and pre-empt previous renders.
                var ix = 0;
                const step = 1000;
                var fn = () => {
                    if (renderNonce != currentNonce) {
                        return;
                    }
                    if (ix >= content.length) {
                        return;
                    }
                    var end = Math.min(content.length, ix + step);
                    elt.appendChild(document.createTextNode(content.slice(ix, end).join('\\n')));
                    ix += step;
                    setTimeout(fn, 0);
                }
                fn();
              };
              eval();
            </script>
            </body>
        </html>`;
	}
}