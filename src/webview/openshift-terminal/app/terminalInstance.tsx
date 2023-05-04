/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Box } from '@mui/material';
import React from 'react';
import { VSCodeMessage } from './vscodeMessage';
import { Terminal, ITheme } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { WebglAddon } from 'xterm-addon-webgl';
import 'xterm/css/xterm.css';

/**
 * Represents a tab in the terminal view. Wraps an instance of xtermjs.
 */
export const TerminalInstance = (props: {
    uuid: string;
    initialFontFamily: string;
    initialFontSize: number;
}) => {
    // Represents a reference to a div where the xtermjs instance is being rendered
    const termRef = React.useRef(null);

    // The xtermjs addon that can be used to resize the terminal according to the size of the div
    const fitAddon = React.useMemo(() => {
        return new FitAddon();
    }, []);

    // The xtermjs instance
    const [term] = React.useState(() => {
        const newTerm = new Terminal();
        newTerm.loadAddon(new WebLinksAddon());
        newTerm.loadAddon(new WebglAddon());
        newTerm.loadAddon(fitAddon);
        return newTerm;
    });

    const setXtermjsTheme = (fontFamily: string, fontSize: number) => {
        const computedStyle = window.getComputedStyle(document.body);
        const xtermjsTheme: ITheme = {
            foreground: computedStyle.getPropertyValue('--vscode-terminal-foreground'),
            background:
                computedStyle.getPropertyValue('--vscode-terminal-background') ||
                computedStyle.getPropertyValue('--vscode-panel-background'),
            cursor:
                computedStyle.getPropertyValue('--vscode-terminalCursor-foreground') ||
                computedStyle.getPropertyValue('--vscode-terminal-foreground'),
            cursorAccent:
                computedStyle.getPropertyValue('--vscode-terminalCursor-background') || undefined,
            selectionBackground: computedStyle.getPropertyValue(
                '--vscode-terminal-selectionBackground',
            ),

            black: computedStyle.getPropertyValue('--vscode-terminal-ansiBlack'),
            red: computedStyle.getPropertyValue('--vscode-terminal-ansiRed'),
            green: computedStyle.getPropertyValue('--vscode-terminal-ansiGreen'),
            yellow: computedStyle.getPropertyValue('--vscode-terminal-ansiYellow'),
            blue: computedStyle.getPropertyValue('--vscode-terminal-ansiBlue'),
            magenta: computedStyle.getPropertyValue('--vscode-terminal-ansiMagenta'),
            cyan: computedStyle.getPropertyValue('--vscode-terminal-ansiCyan'),
            white: computedStyle.getPropertyValue('--vscode-terminal-ansiWhite'),

            brightBlack: computedStyle.getPropertyValue('--vscode-terminal-ansiBrightBlack'),
            brightRed: computedStyle.getPropertyValue('--vscode-terminal-ansiBrightRed'),
            brightGreen: computedStyle.getPropertyValue('--vscode-terminal-ansiBrightGreen'),
            brightYellow: computedStyle.getPropertyValue('--vscode-terminal-ansiBrightYellow'),
            brightBlue: computedStyle.getPropertyValue('--vscode-terminal-ansiBrightBlue'),
            brightMagenta: computedStyle.getPropertyValue('--vscode-terminal-ansiBrightMagenta'),
            brightCyan: computedStyle.getPropertyValue('--vscode-terminal-ansiBrightCyan'),
            brightWhite: computedStyle.getPropertyValue('--vscode-terminal-ansiBrightWhite'),
        };
        term.options.theme = xtermjsTheme;
        term.options.fontSize = fontSize;
        const specifiedFonts = fontFamily.split(',').map((font) => font.trim());
        if (specifiedFonts.length && specifiedFonts[0]) {
            // It would be nice to check if the font is installed on the user's computer.
            // However, the API to do this is experimental and not available in Firefox,
            // so if we do that it will not work in VS Code in the web browser.
            term.options.fontFamily = specifiedFonts[0];
        }
    };

    // connect the xtermjs instance to its <div> element when the <div> element reloads
    React.useEffect(() => {
        if (term) {
            term.open(termRef.current);
            setXtermjsTheme(props.initialFontFamily, props.initialFontSize);
            fitAddon.fit();
        }
        return () => {
            // do nothing
        };
    }, [term, termRef]);

    // Send a message to VS Code to indicate that this terminal (this tab) is currently selected and being rendered.
    // When it's about to be unrendered, send a message to VS Code to indicate this.
    // VS Code uses this information to decide whether to pipe terminal output to the webview or to buffer it.
    React.useEffect(() => {
        window.vscodeApi.postMessage({
            kind: 'termInit',
            data: {
                uuid: props.uuid,
            },
        });

        return () => {
            window.vscodeApi.postMessage({
                kind: 'termSuspend',
                data: {
                    uuid: props.uuid,
                },
            });
        };
    }, []);

    // send the user's input from the terminal back to the pty on the extension side
    React.useEffect(() => {
        const disposable = term.onData((data) => {
            window.vscodeApi.postMessage({
                kind: 'input',
                data: {
                    uuid: props.uuid,
                    data,
                },
            });
        });
        return () => {
            disposable.dispose();
        };
    });

    // respond to messages directed at this terminal coming from VS Code
    // - termInit(uuid, serializedOutput):
    //     when a user switches tabs, the xtermjs instance gets destroyed,
    //     and the output gets destroyed along with it.
    //     To prevent the output from being lost, we save a copy of the output
    //     in a headless terminal instance on the VS Code side.
    //     this message rehydrates the terminal with the data from the headless terminal
    //     when the user switches to this terminal tab.
    // - termOutput(uuid, output): a message containing output from the program the terminal is running
    // - setTheme(kind, fontFamily, fontSize):
    //     sent when the VS Code integrated terminal font settings have been changed
    //     contains the new font settings. the `kind` parameter is ignored
    const respondToMessage = function (message: MessageEvent<VSCodeMessage>) {
        if (message.data.data.uuid === props.uuid) {
            if (message.data.kind === 'termInit') {
                term.write(message.data.data.serializedOutput as string);
            } else if (message.data.kind === 'termOutput') {
                term.write(message.data.data.output as string);
            }
        } else if (message.data.kind === 'setTheme') {
            setXtermjsTheme(message.data.data.fontFamily, message.data.data.fontSize);
        }
    };

    React.useEffect(() => {
        window.addEventListener('message', respondToMessage);
        return () => {
            window.removeEventListener('message', respondToMessage);
        };
    }, []);

    const handleResize = function (_e: UIEvent) {
        const dims = fitAddon.proposeDimensions();
        window.vscodeApi.postMessage({
            kind: 'resize',
            data: {
                uuid: props.uuid,
                ...dims,
            },
        });
        fitAddon.fit();
    };

    // resize the terminal when the window is resized
    React.useEffect(() => {
        addEventListener('resize', handleResize);
        return () => {
            removeEventListener('resize', handleResize);
        };
    }, [fitAddon]);

    return (
        <Box marginY="8px" marginX="16px" width="100%" height="100%">
            <div
                {...{ name: 'terminal-instance' }}
                style={{ width: '100%', height: '100%', display: 'flex', flexFlow: 'column' }}
                ref={termRef}
            ></div>
        </Box>
    );
};
