/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { LazyLog } from 'react-lazylog';
import { List } from 'immutable'

declare global {
    interface Window {
        acquireVsCodeApi(): any;
    }
}

// function stop() {
//     const vscode = window.acquireVsCodeApi();
//     vscode.postMessage({action: 'stop'});
// }

export default class Log extends LazyLog {

    constructor(props: any) {
        super(props);
        const enc = new TextEncoder();
        let wholeLog = `${props.text}\n`;
        window.addEventListener('message', event => {
            const message = event.data; // The JSON data our extension sent
            if (!message.action) return;
            switch (message.action) {
                case 'add': {
                    console.log('add message arrived');
                    message.data.forEach((element: string, index: number)=> {
                        wholeLog = wholeLog.concat(`${element}\n`);
                    });
                    const encodedLines = message.data.map((line) => enc.encode(line));
                    (this as any).handleUpdate({lines: List(encodedLines), encodedLog: enc.encode(wholeLog)});
                    break;
                }
                default:
                    break;
            }
        });
    }
}
