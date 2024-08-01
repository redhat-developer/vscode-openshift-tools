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
    ColorTheme,
    Disposable,
    Webview,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
    commands,
    env,
    window,
    workspace
} from 'vscode';
import { SerializeAddon } from 'xterm-addon-serialize';
import { Terminal } from 'xterm-headless';
import { CommandText } from '../../base/command';
import { CliChannel } from '../../cli';
import { ToolsConfig } from '../../tools';
import { getVscodeModule } from '../../util/credentialManager';
import { Platform } from '../../util/platform';
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

    id: string;
}

/**
 * Represents a command running in the OpenShift Terminal view.
 */
class OpenShiftTerminal {
    private _pty;
    private _file: string;
    private _args: string | string[];
    private _options;
    private _name: string;

    private _sendTerminalData: (data: string) => void;
    private _sendExitMessage: () => void;

    private _onSpawnListener: () => void;
    private _onExitListener: () => void;
    private _onTextListener: (text: string) => void;

    private _uuid: string;
    private _headlessTerm: Terminal;
    private _termSerializer: SerializeAddon;
    private _disposables: { dispose(): void }[];
    private _ptyExited = false;

    private _terminalRendering = false;

    private _buffer: Buffer;

    private _isKnative: boolean;

    /**
     * Creates a new OpenShiftTerminal
     *
     * @param uuid a unique identifier for the terminal
     * @param sendMessage the function used to send a message to the UI terminal
     * @param file the path to the program to execute
     * @param args the arguments to pass to the program
     * @param options the options for spawning the pty (name, current working directory, environment)
     * @param isKnative if the terminal is being used to run a knative-related task
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
        isKnative: boolean,
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

        this._file = file;
        this._args = args;
        this._options = options;
        this._isKnative = isKnative;
        this._name = options.name;

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
            this._pty = (/\s/).test(this._file) ? ptyInstance.spawn(
                `${this._file}`,
                [
                    `${escapedArgs}`,
                ],
                this._options,
            ) : ptyInstance.spawn(
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
        const msg = '\r\n\r\nPress any key to close this terminal\r\n';
        this._sendTerminalData(msg);
        this._headlessTerm.write(msg);
        this._ptyExited = true;
    }

    /**
     * Returns the exe file of the execution.
     *
     * @returns the exe file of the execution.
     */
    public get file() {
        return this._file;
    }

    /**
     * Returns the current working directory of the execution.
     *
     * @returns the current working directory.
     */
    public get cwd(): string {
        return this._options?.cwd;
    }

    /**
     * Returns the name of this terminal.
     *
     * @returns the name of this terminal
     */
    public get name() {
        return this._name;
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
     * Returns the true if it serverless based this terminal.
     *
     * @returns true/false
     */
    public get knative() {
        return this._isKnative;
    }

    /**
     * Returns true if the pty that's running the program associated with this terminal has been started and has not exited, and false otherwise.
     *
     * @returns true if the pty that's running the program associated with this terminal has been started and has not exited, and false otherwise
     */
    public get isPtyLive() {
        return this._pty && !this._ptyExited;
    }

    public get isPtyExit() {
        return this._ptyExited;
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

    /**
     * Close this terminal tab, force killing the process if it's still running.
     */
    public closeTab(): void {
        this.forceKill();
        this._sendExitMessage();
    }

    public clear(): void {
        this._headlessTerm.clear();
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
     * @param _context    ignored
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

        const newHtml: string = await loadWebviewHtml('openshift-terminal', this.webviewView);
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
            async (event) => {
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
                                        serializedOutput: serializedData
                                    }
                                });

                                void this.sendMessage({
                                    kind: 'iconCheck',
                                    data: {
                                        isKnative: terminal.knative
                                    }
                                });
                            })
                            .then(() => {
                                terminal.startRendering();
                            });
                    } else if (message.kind === 'termSuspend') {
                        terminal.stopRendering();
                    } else if (message.kind === 'termClear') {
                        terminal.clear();
                    } else if (message.kind === 'input') {
                        terminal.write(message.data.data);
                    } else if (message.kind === 'resize') {
                        terminal.resize(message.data.cols, message.data.rows);
                    } else if (message.kind === 'closeTerminal') {
                        let serverlessFuncTool = 'func';
                        if (Platform.OS === 'win32') {
                            serverlessFuncTool = serverlessFuncTool.concat('.exe');
                        }
                        if (terminal.file.endsWith(serverlessFuncTool)) {
                            void commands.executeCommand('openshift.Serverless.removeSession' , terminal.uuid, terminal.cwd, terminal.name);
                        }
                        terminal.dispose();
                        this.openShiftTerminals.delete(message?.data?.uuid);
                    } else if (message.kind === 'openExternal') {
                        if (message?.data?.url) {
                            const result = await window.showInformationMessage(
                                'Do you want to open the external website?', 'Yes', 'No');
                            if (result === 'Yes') {
                                void env.openExternal(message?.data?.url);
                            }
                        }
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

    public async executeInTerminal(command: CommandText, cwd: string = process.cwd(), name = 'OpenShift', addEnv = {} as {[key : string]: string} ): Promise<void> {
        const merged = Object.fromEntries([...Object.entries(addEnv), ...Object.entries(CliChannel.createTelemetryEnv()), ...Object.entries(process.env)]);
        await OpenShiftTerminalManager.getInstance().createTerminal(command, name, cwd, merged);
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
     * @param callbacks functions to execute in response to events in the terminal:
     * - onSpawn(): called when the pty is created
     * - onExit(): called when the pty exits (whether normally or though SIGABRT)
     * - onText(): called when text is printed to the terminal, whether by the program or by user input
     * @param isKnative if the terminal is being used to run knative-related tasks
     * @returns an api to interact with the running command
     */
    public async createTerminal(
        commandText: CommandText,
        name: string,
        cwd = process.cwd(),
        env = process.env,
        callbacks?: {
            onSpawn?: () => void;
            onExit?: () => void;
            onText?: (text: string) => void;
        },
        isKnative = false
    ): Promise<OpenShiftTerminalApi> {
        // focus the OpenShift terminal view in order to force the webview to be created
        // (if it hasn't already)
        await commands.executeCommand('openShiftTerminalView.focus');
        // wait until the webview is ready to receive requests to create terminals
        await this.webviewResolved;

        const tool = commandText.command;
        let toolLocation: string | undefined;
        try {
            toolLocation = await ToolsConfig.detect(tool);
        } catch {
            // do nothing
        }
        if (!toolLocation) {
            try {
                await fs.access(tool);
                toolLocation = tool;
            } catch {
                // do nothing
            }
        }
        if (!toolLocation) {
            const msg = `OpenShift Toolkit internal error: could not find ${tool}`;
            void window.showErrorMessage(msg);
            throw new Error(msg);
        }

        // try to clean up an existing exited terminal in place of this one
        for (const existingTerm of this.openShiftTerminals.values()) {
            if (!existingTerm.isPtyLive && existingTerm.name === name) {
                existingTerm.closeTab();
                break;
            }
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
                commandText.args,
                {
                    cwd,
                    env,
                    name,
                },
                isKnative,
                callbacks
            )
        );

        // issue request to create terminal in the webview
        await this.sendMessage({ kind: 'createTerminal', data: { uuid: newTermUUID, name } });

        return {
            sendText: (text: string) => this.openShiftTerminals.get(newTermUUID).write(text),
            focusTerminal: () =>
                void this.sendMessage({ kind: 'switchToTerminal', data: { uuid: newTermUUID } }),
            kill: () => this.openShiftTerminals.get(newTermUUID).write('\u0003'),
            forceKill: () => this.openShiftTerminals.get(newTermUUID).forceKill(),
            id: newTermUUID
        };
    }

    private async sendMessage(msg: Message): Promise<void> {
        await this.webview.postMessage(msg);
    }
}
