/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { LazyLog, LazyLogProps } from 'react-lazylog';
import { List } from 'immutable'

declare global {
    interface Window {
      acquireVsCodeApi(): any;
    }
  }

export default class Log extends LazyLog {
    constructor(props: LazyLogProps) {
        super(props);
        const enc = new TextEncoder();
        window.addEventListener('message', event => {
            const message = event.data; // The JSON data our extension sent
            switch (message.action) {
                case 'add': {
                    const encodedLines = message.data.map((line) => enc.encode(line));
                    (this as any).handleUpdate({lines: List(encodedLines)});
                    break;
                }
                default:
                    break;
            }
        });
    }
}
