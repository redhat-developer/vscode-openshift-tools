/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ExecException, ExecOptions } from 'child_process';
import * as vscode from 'vscode';
import { Util as cp } from '../util/utils';
import { Filters } from './filters';

export interface CliExitData {
    readonly error: ExecException;
    readonly stdout: string;
    readonly stderr: string;
    readonly cwd?: string;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace CliExitData {
    export function failed(result: CliExitData): boolean {
        if (!result) {
            return true; // Treat null result as error
        }
        if (result.error) {
            return true;
        }
        return result.stderr && result.stderr.length > 0;
    }
    export function getErrorMessage(result: CliExitData): string {
        if(CliExitData.failed(result)) {
            return result.error ? result.error.message : result.stderr;
        }
        return '';
    }
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
        } catch {
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

    public execute(cmd: string, opts: ExecOptions = {}, outText?: string): Promise<CliExitData> {
        return new Promise<CliExitData>((resolve) => {
            const childProcess = cp.spawn(cmd, { ...opts, shell: true });

            let stdout = '';
            let stderr = '';

            childProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            childProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            childProcess.on('error', (error) => {
                this.odoChannel.print(cmd);
                this.odoChannel.print(stdout);
                this.odoChannel.print(stderr);
                resolve({ error, stdout: stdout.trim(), stderr: stderr.trim(), cwd: opts.cwd?.toString() });
            });

            childProcess.on('close', (code) => {
                this.odoChannel.print(cmd);
                this.odoChannel.print(stdout);
                this.odoChannel.print(stderr);
                const error = code !== 0 ? new Error(`Exited with code ${code}`) : undefined;
                resolve({ error, stdout: stdout.trim(), stderr: stderr.trim(), cwd: opts.cwd?.toString() });
            });

            if (childProcess && outText) {
                childProcess.stdin.write(outText);
                childProcess.stdin.end();
            }
        });
    }

    public show() {
        this.odoChannel.show();
    }
}
