/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as React from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Downshift from "downshift";
import matchSorter from "match-sorter";
import styled from "styled-components";

declare global {
    interface Window {
      acquireVsCodeApi(): any;
      logPath: string;
    }
  }

interface ConfigProps {
    vscode: any;
    window: any;
}

interface ConfigState {
    text: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Highlight = styled.span`
    color: red;
    background: yellow;
`;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const LogRow = ({ match, children }) => {
    const _match = match.toLowerCase();

    const chunks = match.length
        ? children.split(new RegExp(`(${  match  })`, "ig"))
        : [children];

    return (
        <div>
            {chunks.map(
                chunk =>
                    chunk.toLowerCase() === _match ? (
                        <Highlight>{chunk}</Highlight>
                    ) : (
                        chunk
                    )
            )}
        </div>
    );
};

export default class Log extends React.Component<ConfigProps, ConfigState>  {
    constructor(props: ConfigProps) {
        super(props);
        this.state = {text: ''};
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        window.addEventListener('message', event => {
            const message = event.data; // The JSON data our extension sent
            switch (message.action) {
                case 'info': {
                    window.logPath = message.message;
                    this.updateLogStream(message.message);
                    // eslint-disable-next-line no-console
                    console.log(window.logPath);
                    break;
                }
                default:
                    break;
            }
        });
    }

    updateLogStream(msg): void {
        // eslint-disable-next-line no-alert
        const newState = { ...this.state };
        newState.text = msg;
        this.setState(newState);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    render() {
        return (
        // <div style={{ height: 900, width: 902 }}>
        //     <LazyLog extraLines={1} enableSearch text={ this.state.text } caseInsensitive />
        // </div>
        // );

        // return (
            <Downshift>
                {({ getInputProps, inputValue }) => {
                    const filtered =
                        (!inputValue && this.state.text.split("\n")) || matchSorter(this.state.text.split("\n"), inputValue);

                    return (
                        <div>
                            <input
                                {...getInputProps()}
                                placeholder="Filter logs ..."
                            />
                            {inputValue &&
                                <p>{filtered.length} matches</p>
                            }
                            <pre>
                                {filtered.map(log => (
                                    <LogRow match={inputValue}>{log}</LogRow>
                                ))}
                            </pre>
                        </div>
                    );
                }}
            </Downshift>
        );
        }
}