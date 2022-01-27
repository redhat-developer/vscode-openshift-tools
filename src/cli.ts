/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as vscode from 'vscode';
import { Filters } from './util/filters';

export interface CliExitData {
    readonly error: cp.ExecException;
    readonly stdout: string;
    readonly stderr: string;
    readonly cwd?: string;
}

export interface Cli {
    execute(cmd: string, opts?: cp.ExecOptions): Promise<CliExitData>;
    spawn(cmd: string, params: string[], opts: cp.SpawnOptions): cp.ChildProcess;
}

export interface OdoChannel {
    print(text: string): void;
    show(): void;
}

function prettifyJson(str: string): string {
    let jsonData: string;
    try {
        jsonData = JSON.stringify(JSON.parse(str), null, 2);
    } catch (ignore) {
        const hidePass = Filters.filterToken(str);
        return Filters.filterPassword(hidePass);
    }
    return jsonData;
}

class OdoChannelImpl implements OdoChannel {
    private readonly channel: vscode.OutputChannel = vscode.window.createOutputChannel('OpenShift');

    show(): void {
        this.channel.show();
    }

    print(text: string): void {
        const textData = prettifyJson(text);
        this.channel.append(textData);
        if (!textData.endsWith('\n')) {
            this.channel.append('\n');
        }
        if (
            vscode.workspace
                .getConfiguration('openshiftConnector')
                .get<boolean>('showChannelOnOutput')
        ) {
            this.channel.show();
        }
    }
}

// TODO Refactor to OdoCli or OpenShiftCli class
// This is Cli interface implementation that lets
// execute commands and prints commands and output
// to an output channel

export class CliChannel implements Cli {
    private static instance: CliChannel;

    private odoChannel: OdoChannel = new OdoChannelImpl();

    static getInstance(): CliChannel {
        if (!CliChannel.instance) {
            CliChannel.instance = new CliChannel();
        }
        return CliChannel.instance;
    }

    showOutput(): void {
        this.odoChannel.show();
    }

    async execute(cmd: string, opts: cp.ExecOptions = {}): Promise<CliExitData> {
        return new Promise<CliExitData>((resolve) => {
            if (opts.maxBuffer === undefined) {
                opts.maxBuffer = 2 * 1024 * 1024;
            }
            cp.exec(cmd, opts, (error: cp.ExecException, stdout: string, stderr: string) => {
                // filter out info about update
                this.odoChannel.print(cmd);
                this.odoChannel.print(stdout);
                this.odoChannel.print(stderr);
                // do not reject it here, because caller in some cases need the error and the streams
                // to make a decision
                // Filter update message text which starts with `---`
                resolve({ error, stdout: stdout.trim(), stderr: stderr.trim(), cwd: opts?.cwd?.toString() });
            });
        });
    }

    spawn(cmd: string, params: string[], opts: cp.SpawnOptions = {cwd: undefined, env: process.env}): cp.ChildProcess {
        return cp.spawn(cmd, params, opts);
    }
}
