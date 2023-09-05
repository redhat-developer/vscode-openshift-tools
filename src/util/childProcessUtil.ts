/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as vscode from 'vscode';
import { Filters } from './filters';

export interface CliExitData {
    readonly error: cp.ExecException;
    readonly stdout: string;
    readonly stderr: string;
    readonly cwd?: string;
}

class OdoChannel {

    private static instance = new OdoChannel();

    private channel: vscode.OutputChannel;

    public static get Instance() {
        return OdoChannel.instance;
    }

    public constructor() {
        this.channel = vscode.window.createOutputChannel('OpenShift');
    }

    show(): void {
        this.channel.show();
    }

    print(text: string): void {
        const textData = OdoChannel.prettifyJson(text);
        this.channel.append(textData);
        if (!textData.endsWith('\n')) {
            this.channel.append('\n');
        }
        if (
            vscode.workspace
                .getConfiguration('openshiftToolkit')
                .get<boolean>('showChannelOnOutput')
        ) {
            this.channel.show();
        }
    }

    static prettifyJson(str: string): string {
        let jsonData: string;
        try {
            jsonData = JSON.stringify(JSON.parse(str), null, 2);
        } catch (ignore) {
            const hidePass = Filters.filterToken(str);
            return Filters.filterPassword(hidePass);
        }
        return jsonData;
    }
}

/**
 * Execute command and pipe its output to a VS Code channel.
 * Singleton to avoid recreating the VS Code channel instance,
 * while allowing for stubbing in unit tests.
 */
export class ChildProcessUtil {

    private static instance = new ChildProcessUtil(OdoChannel.Instance);

    private odoChannel: OdoChannel;

    public static get Instance() {
        return ChildProcessUtil.instance;
    }

    private constructor(odoChannel: OdoChannel) {
        this.odoChannel = odoChannel;
    }

    public execute(cmd: string, opts: cp.ExecOptions = {}): Promise<CliExitData> {
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

    public show() {
        this.odoChannel.show();
    }
}
