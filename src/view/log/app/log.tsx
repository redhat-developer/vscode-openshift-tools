/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { LazyLog, LazyLogProps } from 'react-lazylog';
import { List } from 'immutable'

export interface LogProps extends LazyLogProps {
    enableSearch: boolean;
}

export default class Log extends LazyLog {
    private wholeLog: string;
    constructor(props: any) {
        super(props);
        this.wholeLog = `${this.props.text}\n`;
    }

    componentDidMount() {
        super.componentDidMount();
        window.addEventListener('message', this.messageListener);
    }

    messageListener = (event: MessageEvent) => {
        const enc = new TextEncoder();
        if (event?.data?.action){
            const message = event.data; // The JSON data our extension sent
            switch (message.action) {
                case 'add': {
                    message.data.forEach((element: string, index: number)=> {
                        this.wholeLog = this.wholeLog.concat(`${element}\n`);
                    });
                    const encodedLines = message.data.map((line) => enc.encode(line));
                    (this as any).handleUpdate({lines: List(encodedLines), encodedLog: enc.encode(this.wholeLog)});
                    break;
                }
                default:
                    break;
            }
        }
    }

    componentWillUnmount() {
        super.componentWillUnmount();
        window.removeEventListener('message',this.messageListener);
    }
}
