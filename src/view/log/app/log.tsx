/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { LazyLog, LazyLogProps } from 'react-lazylog';
import { List } from 'immutable'

declare global {
    interface Window {
      acquireVsCodeApi(): any;
      logPath: string;
    }
  }

export default class Log extends LazyLog {
    constructor(props: LazyLogProps) {
        super(props);
        window.addEventListener('message', event => {
            const message = event.data; // The JSON data our extension sent
            switch (message.action) {
                case 'info': {
                    break;
                }
                default:
                    break;
            }
        });
        const that = this as any;
        setTimeout(() => {
            console.log('timer kicks back');
            const enc = new TextEncoder();
            that.handleUpdate({lines: List([enc.encode('line1'), enc.encode('line2')])});
        }, 1000);
    }
}
