/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { LazyLog } from 'react-lazylog';
import { List } from 'immutable'

declare global {
    interface Window {
        cmdText: string;
    }
}

export default class Log extends LazyLog {

    constructor(props: any) {
        super(props);
        const enc = new TextEncoder();
        let wholeLog = `${window.cmdText}\n`;
        window.addEventListener('message', event => {
            const message: {action: string, data: string[]} = event.data; // The JSON data our extension sent
            switch (message.action) {
                case 'add': {
                    message.data.forEach((element:string, index: number)=> {
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
