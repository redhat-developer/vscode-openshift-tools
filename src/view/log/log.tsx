/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { List } from 'immutable'

declare global {
    interface Window {
        cmdText: string;
    }
}

// function Log (){
//     <LazyLog text={window.cmdText} caseInsensitive enableSearch: true />
// }

window.addEventListener('message', event => {
    const message: {action: string, data: string[]} = event.data; // The JSON data our extension sent
    // eslint-disable-next-line no-console
    console.log(message.action);
    switch (message.action) {
        case 'add': {
            const lastIndex = message.data.length - 1;
            const enc = new TextEncoder();
            let wholeLog = `${window.cmdText}\n`;
            message.data.forEach((element:string, index: number)=> {
                if (index === lastIndex) {
                    wholeLog = wholeLog.concat(`${element}`);
                } else {
                    wholeLog = wholeLog.concat(`${element}\n`);
                }
            });
            const encodedLines = message.data.map((line) => enc.encode(line));
            (this as any).handleUpdate({lines: List(encodedLines), encodedLog: enc.encode(wholeLog)});
            break;
        }
        default:
    }
});
