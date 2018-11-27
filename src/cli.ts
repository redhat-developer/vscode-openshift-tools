/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import { ExecException } from 'child_process';

export interface CliExitData {
    readonly error: ExecException;
    readonly stdout: string;
    readonly stderr: string;
}

export class Cli implements ICli {
    private static instance: Cli;
    private odoChannel: OdoChannel = new OdoChannelImpl();

    private constructor() {}

    static getInstance(): Cli {
        if (!Cli.instance) {
            Cli.instance = new Cli();
        }
        return Cli.instance;
    }

    async execute(cmd: string, opts: any = {}): Promise<CliExitData> {
        return new Promise<CliExitData>(async (resolve, reject) => {
            const cmdName = cmd.split(' ')[0];
            this.odoChannel.print(cmd);
            if (opts.maxBuffer === undefined) {
                opts.maxBuffer = 2*1024*1024;
            }
            childProcess.exec(cmd, opts, (error: ExecException, stdout: string, stderr: string) => {
                this.odoChannel.print(stdout);
                this.odoChannel.print(stderr);
                // do not reject it here, because caller in some cases need the error and the streams
                // to make a decision
                resolve({ error, stdout: stdout.replace(/---[\s\S]*---/g, '').trim(), stderr });
            });
        });
    }
}

export interface ICli {
    execute(cmd: string, opts?: any): Promise<CliExitData>;
}

export interface OdoChannel {
    print(text: string): void;
}

class OdoChannelImpl implements OdoChannel {
    private readonly channel: vscode.OutputChannel = vscode.window.createOutputChannel("OpenShift");
    print(text: string): void {
        this.channel.append(text);
        if (text.charAt(text.length - 1) !== '\n') {
            this.channel.append('\n');
        }
        if (vscode.workspace.getConfiguration('openshiftConnector').get<boolean>('showChannelOnOutput')) {
            this.channel.show();
        }
    }
}
