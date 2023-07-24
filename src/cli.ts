/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { VSCodeSettings } from '@redhat-developer/vscode-redhat-telemetry/lib/vscode/settings';
import * as cp from 'child_process';
import * as vscode from 'vscode';
import { CommandText } from './base/command';
import { ToolsConfig } from './tools';
import { Filters } from './util/filters';
import { WindowUtil } from './util/windowUtils';
import { VsCommandError } from './vscommand';

export interface CliExitData {
    readonly error: cp.ExecException;
    readonly stdout: string;
    readonly stderr: string;
    readonly cwd?: string;
}

export interface Cli {
    execute(cmd: string, opts?: cp.ExecOptions): Promise<CliExitData>;
    executeTool(command: CommandText, opts?: cp.ExecOptions): Promise<CliExitData>;
    spawn(cmd: string, params: string[], opts: cp.SpawnOptions): cp.ChildProcess;
    spawnTool(cmd: CommandText, opts: cp.SpawnOptions): Promise<cp.ChildProcess>;
    executeInTerminal(cmd: CommandText, cwd: string, terminalName: string): void;
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
                .getConfiguration('openshiftToolkit')
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

    private static telemetrySettings = new VSCodeSettings();
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

    // if (TelemetryConfiguration.getInstance().isEnabled()) {
    //     this.envVars.put("ODO_TRACKING_CONSENT", "yes");
    //     this.envVars.put("TELEMETRY_CALLER", "intellij");
    // } else {
    //     this.envVars.put("ODO_TRACKING_CONSENT", "no");
    // }

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

    async executeTool(command: CommandText, opts?: cp.ExecOptions, fail = false): Promise<CliExitData> {
        const commandActual = command.toString();
        const commandPrivacy = command.privacyMode(true).toString();
        const [cmd] = commandActual.split(' ');
        const toolLocation = await ToolsConfig.detect(cmd);
        const optsCopy = CliChannel.applyEnv(opts, CliChannel.createTelemetryEnv())
        const result: CliExitData = await this.execute(toolLocation ? commandActual.replace(cmd, `"${toolLocation}"`) : commandActual, optsCopy);
        if (result.error && fail) {
            throw new VsCommandError(`${result.error.message}`, `Error when running command: ${commandPrivacy}`, result.error);
        };
        return result;
    }

    async executeInTerminal(command: CommandText, cwd: string, name: string, env = process.env): Promise<void> {
        const [cmd, ...params] = command.toString().split(' ');
        const toolLocation = await ToolsConfig.detect(cmd);
        const envWithTelemetry = {...env, ...CliChannel.createTelemetryEnv()};
        const terminal: vscode.Terminal = WindowUtil.createTerminal(name, cwd, envWithTelemetry);
        terminal.sendText(toolLocation === cmd ? command.toString() : toolLocation.concat(' ', ...params), true);
        terminal.show();
    }

    spawn(cmd: string, params: string[], opts: cp.SpawnOptions = {cwd: undefined, env: process.env}): cp.ChildProcess {
        return cp.spawn(cmd, params, opts);
    }

    async spawnTool(cmd: CommandText, opts: cp.SpawnOptions = {cwd: undefined, env: process.env}): Promise<cp.ChildProcess> {
        const toolLocation = await ToolsConfig.detect(cmd.command);
        const optWithTelemetryEnv = CliChannel.applyEnv(opts, CliChannel.createTelemetryEnv());
        return cp.spawn(toolLocation, [cmd.parameter, ...cmd.options.map((o)=>o.toString())], optWithTelemetryEnv);
    }

}
