import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import * as path from 'path';
import * as download from './download';
import * as fs from 'fs-extra';


export interface CliExitData {
    readonly error: Error;
    readonly stdout: string;
    readonly stderr: string;
}

class Cli implements ICli {

    async execute(cmd: string, opts: any = {}): Promise<CliExitData> {

        const installed = await isToolInstalled(cmd.split(' ')[1]);
        let finalCommand = cmd;
        
        if(!installed) {
            const toFile = path.resolve('c:\\Users\\Eskimo\\.vs-openshift\\odo.exe');
            await fs.ensureDir(path.dirname(toFile));
            download.downloadFile(
                "https://github.com/redhat-developer/odo/releases/download/v0.0.10/odo-windows-amd64.exe", 
                toFile, 
                function(error){
                    console.log(error);
                }, 
                function(progress){
                    console.log(progress);
                }
            );
            finalCommand = cmd.replace("odo", toFile);
        }

        return new Promise<CliExitData>((resolve, reject) => {
            odoChannel.print(finalCommand);
            childProcess.exec(finalCommand, opts, (error: Error, stdout: string, stderr: string) => {
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


 async function isToolInstalled(cmdName: string) {
    return false;
}

export const odoChannel = new OdoChannelImpl();
