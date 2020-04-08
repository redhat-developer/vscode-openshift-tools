/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as React from "react";

interface ConfigProps {
    vscode: any;
    window: any;
}

interface ConfigState {
    counter: number;
}

export default class Log extends React.Component<ConfigProps, ConfigState> {
    constructor(props: ConfigProps) {
        super(props);
        this.state = {counter: 0};

        this.props.window.addEventListener('message', event => {
            const message = event.data; // The JSON data our extension sent
            switch (message.action) {
                case 'info': {
                    this.updateCounter();
                    break;
                }
                default:
                    break;
            }
        });
    }

    updateCounter(): void {
        // eslint-disable-next-line no-alert
        const newState = { ...this.state };
        newState.counter += 1;
        this.setState(newState);
    }

    render(): JSX.Element {
        return (
        <React.Fragment>
            <h1>Welcome to React WebView for Visual Studio Code</h1>
            <br />
            <b>View Calls:</b> <i>{this.state.counter}</i>
            <br />
            <br />
            <input
            type="button"
            value="Say hello to Code"
            onClick={():void => this.sayHello()}
            />
        </React.Fragment>
        );
    }

    sayHello():void {
        // eslint-disable-next-line no-console
        console.log(this.props.vscode);
        this.props.vscode.postMessage({action: 'info', message: 'Hello from WebView based log viewer!'})
    }

}
