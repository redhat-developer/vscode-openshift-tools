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
export interface LogProps extends LazyLogProps {
    enableSearch: boolean;
}

export default class Describe extends LazyLog {
    private content;
    constructor(props: any) {
        super(props);
        this.content = `${this.props.text}\n`;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    componentDidMount() {
        super.componentDidMount();
        window.addEventListener('message', this.messageListener);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    messageListener = (event) => {
        const enc = new TextEncoder();
        if (event?.data?.action){
            const message = event.data; // The JSON data our extension sent
            switch (message.action) {
                case 'describe': {
                    message.data.forEach((element: string, index: number)=> {
                        this.content = this.content.concat(`${element}\n`);
                    });
                    const encodedLines = message.data.map((line) => enc.encode(line));
                    (this as any).handleUpdate({lines: List(encodedLines), encodedLog: enc.encode(this.content)});
                break;
                }
                default:
                    break;
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    componentWillUnmount() {
        super.componentWillUnmount();
        window.removeEventListener('message',this.messageListener);
    }
}