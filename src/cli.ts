import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import * as path from 'path';

export interface CliExitData {
    readonly error: Error;
    readonly stdout: string;
    readonly stderr: string;
}

class Cli implements ICli {
    execute(cmd: string, opts: any = {}): Promise<CliExitData> {
        return new Promise<CliExitData>((resolve, reject) => {
            odoChannel.print(cmd);
            childProcess.exec(cmd, opts, (error: Error, stdout: string, stderr: string) => {
                odoChannel.print(stdout);
                odoChannel.print(stderr);
                resolve({error, stdout, stderr});
            });
        });
    }
}

export interface ICli {
    execute(cmd: string, opts: any): Promise<CliExitData>;
}

export function create() {
    return new Cli();
}

export interface OdoChannel {
    print(text: string);
}

class OdoChannelImpl implements OdoChannel {
    private readonly channel: vscode.OutputChannel = vscode.window.createOutputChannel("OpenShift Do");

    print(text: string) {
        this.channel.append(text);
        if(text.charAt(text.length-1) !== '\n') {
            this.channel.append('\n');
        }
        this.channel.show();
    }
}

export const odoChannel = new OdoChannelImpl();
