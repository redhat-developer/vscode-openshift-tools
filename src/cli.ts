/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import { ExecException, ExecOptions } from 'child_process';
import { Filters } from './util/filters';

export interface CliExitData {
    readonly error: ExecException;
    readonly stdout: string;
    readonly stderr: string;
}
export interface ICli {
    execute(cmd: string, opts?: ExecOptions): Promise<CliExitData>;
}

export interface OdoChannel {
    print(text: string): void;
    show(): void;
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

    async showOutputChannel(): Promise<void> {
        this.odoChannel.show();
    }

    async execute(cmd: string, opts: ExecOptions = {}): Promise<CliExitData> {
        return new Promise<CliExitData>(async (resolve, reject) => {
            this.odoChannel.print(cmd);
            if (opts.maxBuffer === undefined) {
                opts.maxBuffer = 2*1024*1024;
            }
            childProcess.exec(cmd, opts, (error: ExecException, stdout: string, stderr: string) => {
                const stdoutFiltered = stdout.replace(/---[\s\S]*$/g, '').trim();
                this.odoChannel.print(stdoutFiltered);
                this.odoChannel.print(stderr);
                // do not reject it here, because caller in some cases need the error and the streams
                // to make a decision
                // Filter update message text which starts with `---`
                resolve({ error, stdout: stdoutFiltered, stderr });
            });
        });
    }
}

class OdoChannelImpl implements OdoChannel {
    private readonly channel: vscode.OutputChannel = vscode.window.createOutputChannel("OpenShift");

    show(): void {
        this.channel.show();
    }

    prettifyJson(str: string) {
        let jsonData: string;
        try {
            jsonData = JSON.stringify(JSON.parse(str), null, 2);
        } catch (ignore) {
            const hidePass = Filters.filterToken(str);
            return Filters.filterPassword(hidePass);
        }
        return jsonData;
    }

    print(text: string): void {
        const textData = this.prettifyJson(text);
        this.channel.append(textData);
        if (textData.charAt(textData.length - 1) !== '\n') {
            this.channel.append('\n');
        }
        if (vscode.workspace.getConfiguration('openshiftConnector').get<boolean>('showChannelOnOutput')) {
            this.channel.show();
        }
    }
}
