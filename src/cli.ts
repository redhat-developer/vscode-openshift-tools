import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import * as path from 'path';
import * as download from './download';
import * as fsex from 'fs-extra';
import { which } from 'shelljs';
import * as fs from 'fs';
import { Platform } from './platform';

export interface CliExitData {
    readonly error: Error;
    readonly stdout: string;
    readonly stderr: string;
}

const toolsConfig = {
    "odo": {
        "description": "OpenShift Do CLI client",
        "vendor": "Red Hat, Inc.",
        "name": "odo",
        "version": "0.0.10",
        "fileName": "odo",
        "platform": {
            "win32": {
                "url": "https://github.com/redhat-developer/odo/releases/download/v0.0.10/odo-windows-amd64.exe",
                "sha256sum": "",
                "fileName": "odo.exe"
            },
            "darwin": {
                "url": "https://github.com/redhat-developer/odo/releases/download/v0.0.10/odo-darwin-amd64",
                "sha256sum": ""
            },
            "linux": {
                "url": "https://github.com/redhat-developer/odo/releases/download/v0.0.10/odo-linux-amd64",
                "sha256sum": ""
            }
        }
    },
    "oc": {
        "description": "OpenShift CLI Client",
        "vendor": "Red Hat, Inc.",
        "name": "oc",
        "fileName": "oc",
        "version": "0.0.10",
        "platform": {
            "win32": {
                "url": "https://github.com/openshift/origin/releases/download/v3.10.0/openshift-origin-client-tools-v3.10.0-dd10d17-windows.zip",
                "sha256sum": "",
                "fileName": "oc.exe"
            },
            "darwin": {
                "url": "https://github.com/openshift/origin/releases/download/v3.10.0/openshift-origin-client-tools-v3.10.0-dd10d17-mac.zip",
                "sha256sum": ""
            },
            "linux": {
                "url": "https://github.com/openshift/origin/releases/download/v3.10.0/openshift-origin-client-tools-v3.10.0-dd10d17-linux-64bit.tar.gz",
                "sha256sum": ""
            }
        }
    }
};

const tools = loadMetadata(toolsConfig, process.platform);

class Cli implements ICli {
    async execute(cmd: string, opts: any = {}): Promise<CliExitData> {
        const cmdName = cmd.split(' ')[0];
        const odoLocation = await getToolLocation(cmdName);
        let finalCommand = cmd.replace(cmdName, odoLocation);
        return new Promise<CliExitData>((resolve, reject) => {
            odoChannel.print(finalCommand);
            childProcess.exec(finalCommand, opts, (error: Error, stdout: string, stderr: string) => {
                odoChannel.print(stdout);
                odoChannel.print(stderr);
                resolve({ error, stdout, stderr });
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
        if (text.charAt(text.length - 1) !== '\n') {
            this.channel.append('\n');
        }
        this.channel.show();
    }
}

async function getToolLocation(cmd): Promise<string> {
    let toolLocation = path.resolve(Platform.getUserHomePath(), '.vs-openshift', tools[cmd].fileName);
    try {
        fs.accessSync(toolLocation);
    } catch (error) {
        let pathTool = which(cmd);
        if (pathTool === null) {
            odoChannel.print(`Downloading '${cmd}' CLI tool`)
            await fsex.ensureDir(path.dirname(toolLocation));
            await download.downloadFile(
                tools[cmd].url,
                toolLocation,
                function (progress) {
                    odoChannel.print(progress + '%');
                }
            );
        } else {
            toolLocation = cmd;
        }
    }
    return toolLocation;
}

function loadMetadata(requirements, platform) {
    let reqs = JSON.parse(JSON.stringify(requirements));
    for (var object in requirements) {
        if (reqs[object].platform) {
            if (reqs[object].platform[platform]) {
                Object.assign(reqs[object], reqs[object].platform[platform]);
                delete reqs[object].platform;
            } else {
                delete reqs[object];
            }
        }
    }
    return reqs;
}

export const odoChannel = new OdoChannelImpl();
