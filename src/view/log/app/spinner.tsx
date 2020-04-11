/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from "react";

import Loader from 'react-loader-spinner';

declare global {
    interface Window {
        acquireVsCodeApi(): any;
    }
}

function stop() {
    const vscode = window.acquireVsCodeApi();
    vscode.postMessage({action: 'stop'});
}

// Do not change any type, that would lead to props validation error
// during the compile:views
export default function spinner(props: any): JSX.Element {
    const [display ,setDisplay] = React.useState(true);
    window.addEventListener('message', event => {
        if (event.data.action === 'finished') {
            setDisplay(false);
        }
    });

    return display ? (
        <div style={{display: "flex", flexFlow: "row" }}>
            <Loader
                type="Puff"
                color="#00BFFF"
                height= { 20 }
                width= { 20 }
            />
            <div>Loading component's log</div>
            <div><button onClick={stop}>Stop</button></div>
        </div>) : null;
}
