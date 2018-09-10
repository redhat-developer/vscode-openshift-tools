import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import * as path from 'path';
import * as download from './download';
import * as fsex from 'fs-extra';
import { platform } from 'os';
import { which } from 'shelljs';
import * as fs from 'fs';


export interface CliExitData {
    readonly error: Error;
    readonly stdout: string;
    readonly stderr: string;
}

class Cli implements ICli {

    async execute(cmd: string, opts: any = {}): Promise<CliExitData> {
        const cmdName = cmd.split(' ')[0];
        const odoLocation = await getToolLocation(cmdName);
        let finalCommand = cmd.replace("odo", odoLocation);

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


async function getToolLocation(cmd): Promise<string> {
    
    let toolLocation = getDownloadedLocation(cmd);
    try {
        fs.accessSync(toolLocation);
    } catch(error) {
        let pathTool = which(cmd);
        if(pathTool === null) {
            await fsex.ensureDir(path.dirname(toolLocation));
            await download.downloadFile(
                "https://github.com/redhat-developer/odo/releases/download/v0.0.10/odo-windows-amd64.exe", 
                toolLocation, 
                function(progress){
                    console.log(progress + '%');
                }
            );
        } else {
            toolLocation = cmd;
        }
        
    }
    return toolLocation;
}

function getDownloadedLocation(cmd) {
    return path.resolve('c:\\Users\\Eskimo\\.vs-openshift\\odo' + (platform()==='win32'?'.exe':'') );
}

export const odoChannel = new OdoChannelImpl();
