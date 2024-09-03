/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import CloseIcon from '@mui/icons-material/Close';
import TerminalIcon from '@mui/icons-material/Terminal';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import {
    Box,
    PaletteMode,
    Stack,
    SvgIcon,
    Tab,
    ThemeProvider,
    Typography,
    styled
} from '@mui/material';
import React from 'react';
import OpenShiftIcon from '../../../../images/openshift_view.svg';
import KnativeIcon from '../../../../images/knative.svg';
import { createVSCodeTheme } from '../../common/vscode-theme';
import { TerminalInstance } from './terminalInstance';
import { VSCodeMessage } from './vscodeMessage';

/**
 * Represents the label for the tab that's used in the list of tabs.
 *
 * @param props
 * - name: the name of the tab
 * - closeTab: the function to close the tab
 */
const TabLabel = (props: { name: string; closeTab: () => void }) => {
    const TabText = styled('div')(({ theme }) => ({
        ...theme.typography.button,
        textTransform: 'none',
        fontSize: 'var(--vscode-font-size)',
    }));

    return (
        <Stack
            color="inherit"
            sx={{ paddingLeft: '10px', paddingBottom: '0px', paddingTop: '0px' }}
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="space-evenly"
        >
            <TerminalIcon sx={{ fontSize: 'var(--vscode-font-size)' }} color="inherit" />
            <TabText color="inherit">{props.name}</TabText>
            <CloseIcon
                sx={{ fontSize: 'var(--vscode-font-size)' }}
                color="inherit"
                onClick={(_e) => {
                    props.closeTab();
                }}
            />
        </Stack>
    );
};

/**
 * Multiplexes xtermjs terminals and displays them in a tabbed view.
 */
export const TerminalMultiplexer = () => {
    // represents whether this webview is using a dark theme or a light theme
    const [themeKind, setThemeKind] = React.useState<PaletteMode>('dark');

    // represents the font family being used by the VS Code integrated terminal,
    // used when making a new terminal tab
    const fontFamily = React.useRef<string>('monospace');

    // represents the font size being used by the VS Code integrated terminal
    // used when making a new terminal tab
    const fontSize = React.useRef<number>(16);

    // represents the Material UI theme currently being used by this webview
    const theme = React.useMemo(
        () =>
            createVSCodeTheme(themeKind),
        [themeKind],
    );

    // represents the terminals that the multiplexer manages
    const [terminals, setTerminals] = React.useState<{ name: string; terminal: JSX.Element }[]>([]);

    // represents the index of the terminal that is currently being displayed
    const [activeTerminal, setActiveTerminal] = React.useState(0);

    // represents the number of terminals that were present before `terminals` was modified
    const [oldNumTerminals, setOldNumTerminals] = React.useState(0);

    const [isKnative, setKnative] = React.useState(false);

    function reassignActiveTerminal() {
        if (terminals.length === 0) {
            setActiveTerminal(0);
        } else if (activeTerminal >= terminals.length) {
            setActiveTerminal(terminals.length - 1);
        } else if (terminals.length > oldNumTerminals) {
            setActiveTerminal(terminals.length - 1);
        }
        setOldNumTerminals(terminals.length);
    }

    const closeTerminal = function (uuid: string) {
        window.vscodeApi.postMessage({
            kind: 'closeTerminal',
            data: {
                uuid,
            },
        });
        setTerminals((terms) => {
            const i: number = terms.findIndex((terminal) => terminal.terminal.props.uuid === uuid);
            return [...terms.slice(0, i), ...terms.slice(i + 1, terms.length)];
        });
    };

    // Respond to messages coming from VS Code:
    // - createTerminal(uuid, name): create a new terminal tab with the given uuid and name
    // - termExit(uuid): close the terminal tab with the corresponding uuid
    // - setTheme(kind, fontFamily, fontSize):
    //     the colour theme or terminal font settings changed.
    //     update the material UI theme (light vs dark mode) to match.
    //     update the font family and size used to create new terminals.
    // - switchToTerminal(uuid): switch to the terminal tab with the given uuid
    const respondToMessage = function (message: MessageEvent<VSCodeMessage>) {
        if (message.data.kind === 'createTerminal') {
            const uuid = message.data.data.uuid as string;
            setTerminals([
                ...terminals,

                {
                    name: message.data.data.name,
                    terminal: (
                        <TerminalInstance
                            uuid={uuid}
                            initialFontFamily={fontFamily.current}
                            initialFontSize={fontSize.current}
                        />
                    ),
                },
            ]);
            setKnative(message.data.data.isKnative);
        } else if (message.data.kind === 'termExit') {
            const uuid = message.data.data.uuid as string;
            closeTerminal(uuid);
        } else if (message.data.kind === 'setTheme') {
            setThemeKind(message.data.data.kind === 1 ? 'light' : 'dark');
            fontFamily.current = message.data.data.fontFamily;
            fontSize.current = message.data.data.fontSize;
        } else if (message.data.kind === 'switchToTerminal') {
            for (let i = 0; i < terminals.length; i++) {
                if (terminals[i].terminal.props.uuid === message.data.data.uuid) {
                    setActiveTerminal(i);
                    break;
                }
            }
        } else if (message.data.kind === 'iconCheck') {
            setKnative(message.data.data.isKnative);
        }
    };

    // When the number of terminals changes, change the current terminal if needed
    React.useEffect(() => {
        reassignActiveTerminal();
    }, [terminals]);

    // Register the function to respond to messages from VS Code
    React.useEffect(() => {
        window.addEventListener('message', respondToMessage);
        return () => {
            window.removeEventListener('message', respondToMessage);
        };
    }, [terminals, themeKind, activeTerminal]);

    // let VS Code know that the terminal multiplexer is ready to create terminals when the component gets rendered
    React.useEffect(() => {
        window.vscodeApi.postMessage({
            kind: 'termMuxUp',
            data: undefined,
        });
        return () => undefined;
    });

    function handleTabChange(e, value) {
        setActiveTerminal(value);
    }

    function closeTab(tabNum: number) {
        const closedTerminal = terminals[tabNum];
        closeTerminal(closedTerminal.terminal.props.uuid);
    }

    function handleAuxClick(event: React.MouseEvent<HTMLDivElement, MouseEvent>, i: number) {
        // middle click closes tab
        if (event.button === 1) {
            closeTab(i);
        }
    }

    if (!terminals.length) {
        return (
            <Stack justifyContent="center" width="100%" direction="column">
                <Stack direction="row" justifyContent="center" alignItems="center">
                    <SvgIcon
                        component={OpenShiftIcon}
                        htmlColor="red"
                        inheritViewBox
                        sx={{
                            paddingLeft: '16px',
                            paddingRight: '16px',
                            fontSize: 'calc(var(--vscode-font-size) * 1.5)',
                        }}
                    />
                    <Typography>No terminals opened.</Typography>
                </Stack>
                <Stack direction="row" justifyContent="center" alignItems="center">
                    <Typography variant='caption'>Terminals related to operations performed on the OpenShift cluster will appear here</Typography>
                </Stack>
            </Stack>
        );
    }

    return (
        <ThemeProvider theme={theme}>
            <TabContext value={`${activeTerminal}`}>
                <Stack sx={{ width: '100%' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Stack direction="row">
                            <TabList onChange={handleTabChange} sx={{ minHeight: '36px' }}>
                                <Stack justifyContent="center" width="100%">
                                    <SvgIcon
                                        component={ !isKnative  ? OpenShiftIcon : KnativeIcon}
                                        htmlColor={ !isKnative  ? 'red' : 'inherit'}
                                        inheritViewBox
                                        sx={{
                                            paddingLeft: '16px',
                                            paddingRight: '16px',
                                            fontSize: 'calc(var(--vscode-font-size) * 1.5)',
                                        }}
                                    />
                                </Stack>
                                {terminals.map((terminal, i) => (
                                    <Tab
                                        sx={{ padding: '0px', minHeight: '36px' }}
                                        label={
                                            <TabLabel
                                                name={terminal.name}
                                                closeTab={() => {
                                                    closeTab(i);
                                                }}
                                            />
                                        }
                                        value={`${i}`}
                                        key={terminal.terminal.props.uuid}
                                        onAuxClick={(event) => {
                                            handleAuxClick(event, i);
                                        }}
                                    />
                                ))}
                            </TabList>
                        </Stack>
                    </Box>
                    {terminals.map((terminal, i) => (
                        <TabPanel
                            sx={{ margin: '0px', padding: '0px', flex: '1',  height: 'calc(100% - 36px)'}}
                            value={`${i}`}
                            key={terminal.terminal.props.uuid}
                        >
                            {terminal.terminal}
                        </TabPanel>
                    ))}
                </Stack>
            </TabContext>
        </ThemeProvider>
    );
};
