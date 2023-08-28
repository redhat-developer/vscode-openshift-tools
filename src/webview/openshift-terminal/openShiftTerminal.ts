/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import type * as pty from 'node-pty';
import { platform } from 'os';
import {
    CancellationToken,
    ColorTheme, commands, Disposable,
    Webview,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext, window,
    workspace
} from 'vscode';
import { SerializeAddon } from 'xterm-addon-serialize';
import { Terminal } from 'xterm-headless';
import { CommandText } from '../../base/command';
import { ToolsConfig } from '../../tools';
import { getVscodeModule } from '../../util/credentialManager';
import { loadWebviewHtml } from '../common-ext/utils';

// HACK: we cannot include node-pty ourselves,
// since the library can only be run under one version of node
// (whichever one it was compiled for).
// If we want to install the extension across different VS Code versions,
// we need to use the `node-pty` included in those versions
const ptyInstance: typeof pty | undefined = getVscodeModule('node-pty');
if (!ptyInstance) {
    throw new Error('Unable to access node-pty from VS Code');
}

interface Message {
    kind: string;
    data: any;
}

/**
 * An API to interact with a running terminal instance
 */
export interface OpenShiftTerminalApi {
    /**
     * Open the OpenShift terminal and switch to the tab for the given program
     */
    focusTerminal: () => void;

    /**
     * Input text into the terminal.
     *
     * @param text the text to input into the terminal
     */
    sendText: (text: string) => void;

    /**
     * Close the terminal by sending `\u0003` (`^C`).
     */
    kill: () => void;

    /**
     * Close the terminal. If the extension is not running on Windows, the process will be terminated using SIGABRT.
     */
    forceKill: () => void;
}

/**
 * Represents a command running in the OpenShift Terminal view.
 */
class OpenShiftTerminal {
    private _pty;
    private _file: string;
    private _args: string | string[];
    private _options;

    private _sendTerminalData: (data: string) => void;
    private _sendExitMessage: () => void;

    private _onSpawnListener: () => void;
    private _onExitListener: () => void;
    private _onTextListener: (text: string) => void;

    private _closeOnExit: boolean;

    private _uuid: string;
    private _headlessTerm: Terminal;
    private _termSerializer: SerializeAddon;
    private _disposables: { dispose(): void }[];
    private _ptyExited = false;

    private _terminalRendering = false;

    private _buffer: Buffer;

    /**
     * Creates a new OpenShiftTerminal
     *
     * @param uuid a unique identifier for the terminal
     * @param sendMessage the function used to send a message to the UI terminal
     * @param file the path to the program to execute
     * @param args the arguments to pass to the program
     * @param options the options for spawning the pty (name, current working directory, environment)
     * @param closeOnExit true if the terminal should close when the program exits, or false if it should stay open until the user presses an additional key
     * @param callbacks functions to execute in response to events in the terminal:
     * - onSpawn(): called when the pty is created
     * - onExit(): called when the pty exits (whether normally or though SIGABRT)
     * - onText(): called when text is printed to the terminal, whether by the program or by user input
     */
    constructor(
        uuid: string,
        sendMessage: (message: Message) => Promise<void>,
        file: string,
        args: string | string[],
        options,
        closeOnExit = false,
        callbacks?: {
            onSpawn?: () => void;
            onExit?: () => void;
            onText?: (text: string) => void;
        },
    ) {
        this._uuid = uuid;

        this._sendTerminalData = (data) => {
            void sendMessage({ kind: 'termOutput', data: { uuid, output: data } });
        };
        this._sendExitMessage = () => {
            void sendMessage({ kind: 'termExit', data: { uuid } });
        };
        this._onSpawnListener = callbacks?.onSpawn || (() => undefined);
        this._onExitListener = callbacks?.onExit || (() => undefined);
        this._onTextListener = callbacks?.onText || ((_text: string) => undefined);

        this._closeOnExit = closeOnExit;

        this._file = file;
        this._args = args;
        this._options = options;

        this._disposables = [];
        this._headlessTerm = new Terminal({ allowProposedApi: true });
        this._termSerializer = new SerializeAddon();
        this._headlessTerm.loadAddon(this._termSerializer);
        this._buffer = Buffer.from('');

        this._disposables.push(this._headlessTerm);
        this._disposables.push(this._termSerializer);
    }

    startPty() {
        if (platform() === 'win32') {
            const escapedArgs = Array.isArray(this._args)
                ? this._args.join(' ')
                : this._args;
            this._options.useConpty = false;
            this._pty = ptyInstance.spawn(
                'cmd.EXE',
                [
                    '/c',
                    `${this._file} ${escapedArgs}`,
                ],
                this._options,
            );
        } else {
            this._pty = ptyInstance.spawn(this._file, this._args, this._options);
        }
        this._disposables.push(
            this._pty.onData((data) => {
                if (this._terminalRendering) {
                    this._sendTerminalData(data);
                    this._headlessTerm.write(data);
                    this._onTextListener(data);
                } else {
                    this._buffer = Buffer.concat([this._buffer, Buffer.from(data)]);
                    this._onTextListener(data);
                }
            }),
        );
        this._disposables.push(
            this._pty.onExit((_e) => {
                this.onExit();
            }),
        );
        this._onSpawnListener();
    }

    private onExit() {
        this._onExitListener();
        if (this._closeOnExit) {
            this._sendExitMessage();
        } else {
            const msg = '\r\n\r\nPress any key to close this terminal\r\n';
            this._sendTerminalData(msg);
            this._headlessTerm.write(msg);
        }
        this._ptyExited = true;
    }

    /**
     * Returns the unique identifier of this terminal.
     *
     * @returns the unique identifier of this terminal
     */
    public get uuid() {
        return this._uuid;
    }

    /**
     * Returns true if the pty that's running the program associated with this terminal has been started and has not exited, and false otherwise.
     *
     * @return true if the pty that's running the program associated with this terminal has been started and has not exited, and false otherwise
     */
    public get isPtyLive() {
        return this._pty && !this._ptyExited;
    }

    /**
     * Returns the string data of the terminal, serialized
     */
    public serialized(): Promise<string> {
        return new Promise<string>((resolve) => {
            this._headlessTerm.write(this._buffer, () => {
                resolve(this._termSerializer.serialize());
            });
            this._buffer = Buffer.from('');
        });
    }

    /**
     * Resizes the terminal to the given size.
     *
     * @param cols the new number of columns for the terminal
     * @param rows the new number of rows for the terminal
     */
    public resize(cols: number, rows: number): void {
        if (this.isPtyLive) {
            this._pty.resize(cols, rows);
        }
        this._headlessTerm.resize(cols, rows);
    }

    /**
     * Input text into the terminal.
     *
     * @param data the text to input into the terminal
     */
    public write(data: string) {
        if (this.isPtyLive) {
            this._pty.write(data);
        } else if (this._ptyExited) {
            this._sendExitMessage();
        }
    }

    /**
     * Dispose of all resources associated with this terminal.
     */
    public dispose(): void {
        if (this.isPtyLive) {
            const termKilled = new Promise<void>((resolve) => {
                this._disposables.push(
                    this._pty.onExit((_e) => {
                        resolve();
                    }),
                );
            });
            this._pty.kill();
            void Promise.race([
                termKilled,
                new Promise<void>((_, reject) => {
                    // force kill the terminal if it takes more than a minute to shut down
                    setTimeout(reject, 60_000);
                }),
            ])
                .then(() => {
                    for (const disposable of this._disposables) {
                        disposable.dispose();
                    }
                })
                .catch((_error) => {
                    // force kill handles disposing of the disposables
                    this.forceKill();
                });
        } else {
            for (const disposable of this._disposables) {
                disposable.dispose();
            }
        }
    }

    /**
     * Send SIGABRT to the program if it's running and the operating system is not on Windows,
     * then dispose of all resources associated with this terminal.
     */
    public forceKill(): void {
        if (this.isPtyLive) {
            if (platform() !== 'win32') {
                this._pty.kill('SIGABRT');
                // pty won't send the exit message, so we have to perform the exit code ourselves
                this.onExit();
            }
            // can't do anything better on windows, so just wait
        }
        this.dispose();
    }

    /**
     * Start the program if it hasn't been started yet, and start sending data to the terminal UI.
     */
    public startRendering(): void {
        this._terminalRendering = true;
        if (!this._pty) {
            this.startPty();
        }
    }

    /**
     * Stop sending data to the terminal UI.
     *
     * Terminal output will be buffered in a headless terminal until rendering is started again.
     */
    public stopRendering(): void {
        this._terminalRendering = false;
    }
}

/**
 * Represents the OpenShift Terminal view.
 */
export class OpenShiftTerminalManager implements WebviewViewProvider {
    private static INSTANCE = new OpenShiftTerminalManager();

    private webview: Webview;
    private webviewView: WebviewView;
    private readonly openShiftTerminals: Map<string, OpenShiftTerminal> = new Map();

    private webviewResolved: Promise<void>;
    private markWebviewResolved: () => void;

    constructor() {
        // create a promise that is resolved when `markWebviewResolved` is called
        this.webviewResolved = new Promise((resolve) => {
            this.markWebviewResolved = resolve;
        });
    }

    public static getInstance() {
        return OpenShiftTerminalManager.INSTANCE;
    }

    /**
     * Resolves the HTML content for the webview of the given webview view.
     *
     * To be called by VS Code only
     *
     * @param webviewView the webview view containing the webview to resolve the content for
     * @param context     ignored
     * @param token       the cancellation token
     */
    async resolveWebviewView(
        webviewView: WebviewView,
        _context: WebviewViewResolveContext<unknown>,
        token: CancellationToken,
    ): Promise<void> {
        this.webviewView = webviewView;
        this.webview = webviewView.webview;

        this.webviewView.show();

        this.webview.options = {
            enableScripts: true,
        };

        const newHtml: string = await loadWebviewHtml('openshiftTerminalViewer', this.webviewView);
        if (!token.isCancellationRequested) {
            this.webview.html = newHtml;
        }
        const disposables: Disposable[] = [];

        // handle messages from the webview:
        // - `termInit(uuid): string`: one of the following happened
        //   - a terminal was created in the webview and is ready to receive output; start the pty
        //   - an existing webview terminal which had been unfocused was refocused.
        //     Since the terminal output gets cleared between tab switches,
        //     rehydrate the terminal with the old output
        //     and start forwarding pty data to the terminal again
        // - `termSuspend(uuid): void`: the given webview terminal was unfocused; stop sending pty data to the terminal
        // - `input(uuid): void`: then given webview terminal received user input; pass this on to the pty
        // - `resize(uuid, row, col): void`: the given webview terminal was resize; resize the headless terminal, and resize the pty if it's still alive
        // - `closeTerminal(uuid): void`: the given webview terminal was closed; kill the process if needed and dispose of all the resources for the terminal in node
        // - `termMuxUp(): void`: the webview has rendered for the first time and is ready to respond to `createTerminal` messages
        this.webview.onDidReceiveMessage(
            (event) => {
                const message = event as Message;
                const terminal = this.openShiftTerminals.get(message?.data?.uuid);
                if (terminal) {
                    if (message.kind === 'termInit') {
                        void terminal
                            .serialized()
                            .then((serializedData) => {
                                void this.sendMessage({
                                    kind: 'termInit',
                                    data: {
                                        uuid: terminal.uuid,
                                        serializedOutput: serializedData,
                                    },
                                });
                            })
                            .then(() => {
                                terminal.startRendering();
                            });
                    } else if (message.kind === 'termSuspend') {
                        terminal.stopRendering();
                    } else if (message.kind === 'input') {
                        terminal.write(message.data.data);
                    } else if (message.kind === 'resize') {
                        terminal.resize(message.data.cols, message.data.rows);
                    } else if (message.kind === 'closeTerminal') {
                        terminal.dispose();
                        this.openShiftTerminals.delete(message?.data?.uuid);
                    }
                } else if (message.kind === 'termMuxUp') {
                    // mark the webview as resolved, to signal to `createTerminal`
                    // that it can issue requests to get a terminal
                    this.markWebviewResolved();
                }
            },
            undefined,
            disposables,
        );

        webviewView.onDidDispose(() => {
            disposables.forEach((disposable) => {
                disposable.dispose();
            });
        });

        // Synchronize the color theme, font family, and font size of VS Code with the webview

        workspace.onDidChangeConfiguration((e) => {
            // adapt to the font family and size changes
            // see note in ./app/index.tsx for a detailed explanation on why
            // we listen to 'editor' config changes
            // instead of 'terminal.integrated' config changes
            if (e.affectsConfiguration('terminal.integrated')) {
                void this.sendMessage({
                    kind: 'setTheme',
                    data: {
                        kind: window.activeColorTheme.kind,
                        fontFamily: workspace
                            .getConfiguration('terminal.integrated')
                            .get('fontFamily'),
                        fontSize: Number.parseInt(
                            workspace.getConfiguration('terminal.integrated').get('fontSize'),
                            10,
                        ),
                    },
                });
            }
        }, disposables);

        void this.webviewResolved.then(() => {
            void this.sendMessage({
                kind: 'setTheme',
                data: {
                    kind: window.activeColorTheme.kind,
                    fontFamily: workspace.getConfiguration('terminal.integrated').get('fontFamily'),
                    fontSize: Number.parseInt(
                        workspace.getConfiguration('terminal.integrated').get('fontSize'),
                        10,
                    ),
                },
            });
            disposables.push(
                window.onDidChangeActiveColorTheme((colorTheme: ColorTheme) => {
                    void this.sendMessage({
                        kind: 'setTheme',
                        data: {
                            kind: colorTheme.kind,
                            fontFamily: workspace
                                .getConfiguration('terminal.integrated')
                                .get('fontFamily'),
                            fontSize: Number.parseInt(
                                workspace.getConfiguration('terminal.integrated').get('fontSize'),
                                10,
                            ),
                        },
                    });
                }),
            );
        });
    }

    /**
     * Run a command in the OpenShift Terminal view and return an api to interact with the running command.
     *
     * The command will be run in a new 'tab' of the terminal.
     *
     * @param commandText the command to run in the terminal
     * @param name the display name of the terminal session
     * @param cwd the current working directory to use when running the command
     * @param env the environment to use when running the command
     * @param exitOnClose true if the terminal should close when the program exits, or false if it should stay open until the user presses an additional key
     * @param callbacks functions to execute in response to events in the terminal:
     * - onSpawn(): called when the pty is created
     * - onExit(): called when the pty exits (whether normally or though SIGABRT)
     * - onText(): called when text is printed to the terminal, whether by the program or by user input
     * @returns an api to interact with the running command
     */
    public async createTerminal(
        commandText: CommandText,
        name: string,
        cwd = process.cwd(),
        env = process.env,
        exitOnClose = false,
        callbacks?: {
            onSpawn?: () => void;
            onExit?: () => void;
            onText?: (text: string) => void;
        },
    ): Promise<OpenShiftTerminalApi> {
        // focus the OpenShift terminal view in order to force the webview to be created
        // (if it hasn't already)
        await commands.executeCommand('openShiftTerminalView.focus');
        // wait until the webview is ready to receive requests to create terminals
        await this.webviewResolved;

        const [cmd, ...args] = `${commandText}`.split(' ');
        let toolLocation: string | undefined;
        try {
            toolLocation = await ToolsConfig.detect(cmd);
        } catch (_e) {
            // do nothing
        }
        if (!toolLocation) {
            try {
                await fs.access(cmd);
                toolLocation = cmd;
            } catch (__e) {
                // do nothing
            }
        }
        if (!toolLocation) {
            const msg = `OpenShift Toolkit internal error: could not find ${cmd}`;
            void window.showErrorMessage(msg);
            throw new Error(msg);
        }

        const newTermUUID = randomUUID();

        // create the object that manages the headless terminal and the pty.
        // the process is run as a child process under node.
        // the webview is synchronized to the pty and headless terminal using message passing
        this.openShiftTerminals.set(
            newTermUUID,
            new OpenShiftTerminal(
                newTermUUID,
                (message: Message) => {
                    return this.sendMessage(message);
                },
                toolLocation,
                args,
                {
                    cwd,
                    env,
                    name,
                },
                exitOnClose,
                callbacks,
            ),
        );

        // issue request to create terminal in the webview
        await this.sendMessage({ kind: 'createTerminal', data: { uuid: newTermUUID, name } });

        return {
            sendText: (text: string) => this.openShiftTerminals.get(newTermUUID).write(text),
            focusTerminal: () =>
                void this.sendMessage({ kind: 'switchToTerminal', data: { uuid: newTermUUID } }),
            kill: () => this.openShiftTerminals.get(newTermUUID).write('\u0003'),
            forceKill: () => this.openShiftTerminals.get(newTermUUID).forceKill(),
        };
    }

    private async sendMessage(msg: Message): Promise<void> {
        await this.webview.postMessage(msg);
    }
}
