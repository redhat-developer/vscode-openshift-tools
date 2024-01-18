/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Box, Button, Paper, Stack, Typography, debounce } from '@mui/material';
import React from 'react';
import { VSCodeMessage } from './vscodeMessage';
import { Terminal, ITheme } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { WebglAddon } from 'xterm-addon-webgl';
import 'xterm/css/xterm.css';
import '../../common/scrollbar.scss';

/**
 * Clone of VS Code's context menu with "Copy", "Select All", and "Clear" items.
 */
const TerminalContextMenu = (props: {
    onClearHandler: React.MouseEventHandler<HTMLButtonElement>;
    onCopyHandler: React.MouseEventHandler<HTMLButtonElement>;
    onSelectAllHandler: React.MouseEventHandler<HTMLButtonElement>;
    onPasteHandler: React.MouseEventHandler<HTMLButtonElement>;
}) => {
    return (
        <Paper
            variant='outlined'
            sx={{
                borderRadius: '6px',
                backgroundColor: 'var(--vscode-editor-background)',
                borderColor: 'var(--vscode-menu-border)',
                boxShadow: '0px 0px 8px var(--vscode-widget-shadow)',
            }}
        >
            <Stack direction='column' minWidth='200px' marginX='4px' marginY='3px'>
                <Button
                    variant='text'
                    onClick={props.onCopyHandler}
                    sx={{
                        width: '100%',
                        textTransform: 'none',
                        '&:hover': {
                            backgroundColor:
                                'color-mix(in srgb, var(--vscode-button-background) 50%, black)',
                        },
                        paddingY: '4px',
                    }}
                >
                    <Stack
                        direction='row'
                        justifyContent='space-between'
                        marginX='13px'
                        style={{ width: '100%' }}
                    >
                        <Typography variant='body1'>Copy</Typography>
                        <Typography variant='body1'>Ctrl+Shift+C</Typography>
                    </Stack>
                </Button>
                <Button
                    variant='text'
                    onClick={props.onSelectAllHandler}
                    sx={{
                        width: '100%',
                        textTransform: 'none',
                        '&:hover': {
                            backgroundColor:
                                'color-mix(in srgb, var(--vscode-button-background) 50%, black)',
                        },
                        paddingY: '4px',
                    }}
                >
                    <Stack
                        direction='row'
                        justifyContent='space-between'
                        marginX='13px'
                        style={{ width: '100%' }}
                    >
                        <Typography variant='body1'>Select All</Typography>
                        <Typography variant='body1'>Ctrl+Shift+A</Typography>
                    </Stack>
                </Button>
                <Button
                    variant='text'
                    onClick={props.onPasteHandler}
                    sx={{
                        width: '100%',
                        textTransform: 'none',
                        '&:hover': {
                            backgroundColor:
                                'color-mix(in srgb, var(--vscode-button-background) 50%, black)',
                        },
                        paddingY: '4px',
                    }}
                >
                    <Stack
                        direction='row'
                        justifyContent='space-between'
                        marginX='13px'
                        style={{ width: '100%' }}
                    >
                        <Typography variant='body1'>Paste</Typography>
                        <Typography variant='body1'>Ctrl+Shift+V</Typography>
                    </Stack>
                </Button>
                <Button
                    variant='text'
                    onClick={props.onClearHandler}
                    sx={{
                        width: '100%',
                        textTransform: 'none',
                        '&:hover': {
                            backgroundColor:
                                'color-mix(in srgb, var(--vscode-button-background) 50%, black)',
                        },
                        paddingY: '4px',
                    }}
                >
                    <Stack
                        direction='row'
                        justifyContent='flex-start'
                        marginX='13px'
                        style={{ width: '100%' }}
                    >
                        <Typography variant='body1'>Clear</Typography>
                    </Stack>
                </Button>
            </Stack>
        </Paper>
    );
};

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

    const [isContextMenuOpen, setContextMenuOpen] = React.useState(false);
    const contextMenuRef = React.useRef(null);

    const handleContextMenu = (event) => {
        event.preventDefault();
        setContextMenuOpen(true);
        const { pageX, pageY } = event;
        contextMenuRef.current.style.left = `${pageX}px`;
        contextMenuRef.current.style.top = `${pageY}px`;

        // Close the context menu when clicking outside of it
        const handleOutsideClick = () => {
            setContextMenuOpen(false);
        };

        document.addEventListener('click', handleOutsideClick);
    };

    const handleCopy = () => {
        void navigator.clipboard.writeText(term.getSelection());
        setContextMenuOpen(false);
    };

    const handlePaste = () => {
        void navigator.clipboard.readText().then((clipboardContent: string) => {
            term.paste(clipboardContent);
        });
        setContextMenuOpen(false);
    };

    const handleSelectAll = () => {
        term.selectAll();
        setContextMenuOpen(false);
    };

    const handleClear = () => {
        term.clear();
        window.vscodeApi.postMessage({
            kind: 'termClear',
            data: {
                uuid: props.uuid,
            },
        });
    };

    // The xtermjs addon that can be used to resize the terminal according to the size of the div
    const fitAddon = React.useMemo(() => {
        return new FitAddon();
    }, []);

    // A workaround to https://github.com/microsoft/vscode/issues/186043
    function handleLink(event: MouseEvent, uri: string): void {
        window.vscodeApi.postMessage({
            kind: 'openExternal',
            data: {
                uuid: props.uuid,
                url: uri,
            },
        });
    }

    // The xtermjs instance
    const [term] = React.useState(() => {
        const newTerm = new Terminal();
        newTerm.loadAddon(new WebLinksAddon(handleLink));
        newTerm.loadAddon(new WebglAddon());
        newTerm.loadAddon(fitAddon);
        newTerm.attachCustomKeyEventHandler((keyboardEvent: KeyboardEvent) => {
            // Copy/Paste/Select All keybinding handlers
            if (keyboardEvent.shiftKey && keyboardEvent.ctrlKey) {
                // https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values
                if (keyboardEvent.code === 'KeyC' && term.hasSelection) {
                    // Ctrl+Shift+C copies
                    void navigator.clipboard.writeText(term.getSelection());
                    keyboardEvent.stopPropagation();
                    return false;
                } else if (keyboardEvent.code === 'KeyA') {
                    // Ctrl+Shift+A selects all
                    term.selectAll();
                    keyboardEvent.stopPropagation();
                    return false;
                } else if (keyboardEvent.code === 'KeyV') {
                    // Ctrl+Shift+V pastes
                    debounce(() => {
                        void navigator.clipboard
                            .readText() //
                            .then((clipboardContent: string) => {
                                term.paste(clipboardContent);
                            });
                    });
                    keyboardEvent.stopPropagation();
                    return false;
                }
            }

            return true;
        });
        return newTerm;
    });

    React.useEffect(() => {
        const contextMenuListener = (event) => {
            event.preventDefault();
        };
        window.addEventListener('contextmenu', contextMenuListener);
        return window.removeEventListener('contextmenu', contextMenuListener);
    });

    let resizeTimeout: NodeJS.Timeout = undefined;

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

    const performResize = function () {
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

    const handleResize = function (_e: UIEvent) {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(performResize, 200);
    };

    // resize the terminal when the window is resized
    React.useEffect(() => {
        addEventListener('resize', handleResize);
        return () => {
            removeEventListener('resize', handleResize);
        };
    }, [fitAddon]);

    return (
        <Box
            onContextMenu={handleContextMenu}
            marginY='8px'
            marginX='16px'
            width='100%'
            height='100%'
            overflow='scroll'
        >
            <div
                style={{
                    zIndex: 1000,
                    position: 'absolute',
                    display: isContextMenuOpen ? 'block' : 'none',
                }}
                ref={contextMenuRef}
            >
                <TerminalContextMenu
                    onCopyHandler={handleCopy}
                    onSelectAllHandler={handleSelectAll}
                    onClearHandler={handleClear}
                    onPasteHandler={handlePaste}
                />
            </div>
            <div
                {...{ name: 'terminal-instance' }}
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexFlow: 'column',
                    overflow: 'hidden',
                }}
                ref={termRef}
            ></div>
        </Box>
    );
};
