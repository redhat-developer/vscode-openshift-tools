import * as shelljs from 'shelljs';
import * as vscode from 'vscode';

export interface CliExitData {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
}

export function execute(cmd: string, opts: any): Promise<CliExitData> {
    return new Promise<CliExitData>((resolve, reject) => {
        odoChannel.print(cmd);
        shelljs.exec(cmd, opts, (code, stdout, stderr) => {
            odoChannel.print(stdout);
            odoChannel.print(stderr);
            resolve({code, stdout, stderr});
        });
    });
}

export interface Cli {
    execute(cmd: string, opts: any): Promise<CliExitData>;
}

export function create() {
    return {execute};
}

export interface OdoChannel {
    print(text: string);
}

class OdoChannelImpl implements OdoChannel {
    private readonly channel: vscode.OutputChannel = vscode.window.createOutputChannel("OpenShift Do");

    print(text: any) {
        this.channel.append(text);
        this.channel.append('\n');
        this.channel.show();
    }
}

export const odoChannel = new OdoChannelImpl();
