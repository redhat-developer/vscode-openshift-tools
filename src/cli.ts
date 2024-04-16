/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { VSCodeSettings } from '@redhat-developer/vscode-redhat-telemetry/lib/common/vscode/settings';
import * as vscode from 'vscode';
import * as cp from 'child_process';
import { CommandText } from './base/command';
import { ToolsConfig } from './tools';
import { ChildProcessUtil, CliExitData } from './util/childProcessUtil';
import { VsCommandError } from './vscommand';

export class CliChannel {

    private static telemetrySettings = new VSCodeSettings();
    private static instance: CliChannel;

    static getInstance(): CliChannel {
        if (!CliChannel.instance) {
            CliChannel.instance = new CliChannel();
        }
        return CliChannel.instance;
    }

    showOutput(): void {
        ChildProcessUtil.Instance.show();
    }

    static createTelemetryEnv(): {[key:string]: string} {
        const env = {
            ...process.env,
            TELEMETRY_CALLER: 'vscode',
            ODO_TRACKING_CONSENT: 'no',
        };

        if (CliChannel.telemetrySettings.isTelemetryEnabled()) {
            env.ODO_TRACKING_CONSENT = process.env.VSCODE_REDHAT_TELEMETRY_DEBUG === 'true' ? 'no' : 'yes';
        }

        return env;
    }

    static applyEnv<T extends cp.ProcessEnvOptions>(opts: T, env: {[key:string]: string}): cp.ExecOptions {
        let optsCopy: cp.ExecOptions;
        if (opts) {
            optsCopy = { ...opts };
            optsCopy.env = opts.env ? {...process.env, ...opts.env, ...env} : env;
        } else {
            optsCopy = { env: {...process.env, ...env }}
        }
        return optsCopy;
    }

    async executeTool(command: CommandText, opts?: cp.ExecOptions, fail = true): Promise<CliExitData> {
        const commandActual = command.toString();
        const commandPrivacy = command.privacyMode(true).toString();
        const [cmd] = commandActual.split(' ');
        const toolLocation = await ToolsConfig.detect(cmd);
        const optsCopy = CliChannel.applyEnv(opts, CliChannel.createTelemetryEnv())
        const result: CliExitData = await ChildProcessUtil.Instance.execute(toolLocation ? commandActual.replace(cmd, `"${toolLocation}"`) : commandActual, optsCopy);
        if (result.error && fail) {
            if (result.error.code && result.error.code.toString() === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
                void vscode.window.showErrorMessage('Do you want to change the maximum \'stdout\' buffer size by modifying the \'openshiftToolkit.execMaxBufferLength\' preference value?', 'Yes', 'Cancel')
                    .then((answer)=> {
                        if (answer === 'Yes') {
                            void vscode.commands.executeCommand('workbench.action.openSettings', 'openshiftToolkit.execMaxBufferLength');
                        }
                    });
            }
            throw new VsCommandError(`${result.error.message}`, `Error when running command: ${commandPrivacy}`, result.error);
        };
        return result;
    }

    async spawnTool(cmd: CommandText, opts: cp.SpawnOptions = {cwd: undefined, env: process.env}): Promise<cp.ChildProcess> {
        const toolLocation = await ToolsConfig.detect(cmd.command);
        const optWithTelemetryEnv = CliChannel.applyEnv(opts, CliChannel.createTelemetryEnv());
        return cp.spawn(toolLocation, [cmd.parameter, ...cmd.options.map((o)=>o.toString())], optWithTelemetryEnv);
    }

    /**
     * Executes a specified command in non-blocking sychronous way and returns the command output
     *
     * @param cmd A comand to execute
     * @param opts Execution options that may be used to specify operation timeout, maximun buffer size, etc.
     * @returns Output of from the command execution
     */
    async executeSyncTool(cmd: CommandText, opts: cp.ExecFileOptions): Promise<string> {
        const options = {
            ...opts,
        } as cp.ExecFileOptionsWithStringEncoding

        if (options.maxBuffer === undefined) {
            options.maxBuffer = 2 * 1024 * 1024;
        }
        if (options.timeout === undefined) {
            options.timeout = 10 * 1000; // 10 seconds
        }
        if (options.encoding === undefined) {
            options.encoding = 'utf-8';
        }
        if (options.killSignal === undefined) {
            options.killSignal = 'SIGKILL';
        }

        const toolLocation = await ToolsConfig.detect(cmd.command);
        const optWithTelemetryEnv = CliChannel.applyEnv(options, CliChannel.createTelemetryEnv()) as cp.ExecFileSyncOptionsWithStringEncoding;
        return cp.execFileSync(toolLocation, [cmd.parameter, ...cmd.options.map((o)=>o.toString())], optWithTelemetryEnv);
    }
}
