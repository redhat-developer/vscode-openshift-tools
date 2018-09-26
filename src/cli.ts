import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import * as path from 'path';
import * as download from './download';
import * as fsex from 'fs-extra';
import { which } from 'shelljs';
import * as fs from 'fs';
import { Platform } from './platform';
import targz = require('targz');
import unzipm = require('unzip-stream');
import mkdirp = require('mkdirp');
import * as zlib from 'zlib';

export interface CliExitData {
    readonly error: Error;
    readonly stdout: string;
    readonly stderr: string;
}

const toolsConfig = {
    odo: {
        description: "OpenShift Do CLI client",
        vendor: "Red Hat, Inc.",
        name: "odo",
        version: "0.0.12",
        dlFileName: "odo",
        cmdFileName: "odo",
        filePrefix: "",
        platform: {
            win32: {
                url: "https://github.com/redhat-developer/odo/releases/download/v0.0.12/odo-windows-amd64.exe.gz",
                sha256sum: "4f7719ef1f11aac22474d36608996b016305c65afb6e9e3dcd4361c43fb54be1",
                dlFileName: "odo-windows-amd64.exe.gz",
                cmdFileName: "odo.exe"
            },
            darwin: {
                url: "https://github.com/redhat-developer/odo/releases/download/v0.0.12/odo-darwin-amd64.gz",
                sha256sum: "3b77cf5d2a79f7484617715271b9f3c8da4a6e85afdf63f075ad09062f007861",
                dlFileName: "odo-darwin-amd64.gz"
            },
            linux: {
                url: "https://github.com/redhat-developer/odo/releases/download/v0.0.12/odo-linux-amd64.gz",
                sha256sum: "848dae9a3ad109a6dc0f305c890dd1edba1c3b704e8e163285047d93d9f58062",
                dlFileName: "odo-linux-amd64.gz"
            }
        }
    },
    oc: {
        description: "OpenShift CLI Client",
        vendor: "Red Hat, Inc.",
        name: "oc",
        fileName: "oc",
        version: "0.0.10",
        filePrefix: "",
        platform: {
            win32: {
                url: "https://github.com/openshift/origin/releases/download/v3.10.0/openshift-origin-client-tools-v3.10.0-dd10d17-windows.zip",
                sha256sum: "",
                dlFileName: "oc.zip",
                cmdFileName: "oc.exe"
            },
            darwin: {
                url: "https://github.com/openshift/origin/releases/download/v3.10.0/openshift-origin-client-tools-v3.10.0-dd10d17-mac.zip",
                sha256sum: "",
                dlFileName: "oc.zip",
                cmdFileName: "oc"
            },
            linux: {
                url: "https://github.com/openshift/origin/releases/download/v3.10.0/openshift-origin-client-tools-v3.10.0-dd10d17-linux-64bit.tar.gz",
                sha256sum: "",
                fileName: "oc.tar.gz",
                dlFileName: "oc.tar.gz",
                cmdFileName: "oc",
                filePrefix: "openshift-origin-client-tools-v3.10.0-dd10d17-linux-64bit"
            }
        }
    }
};

const tools = loadMetadata(toolsConfig, process.platform);

class Cli implements ICli {
    async execute(cmd: string, opts: any = {}): Promise<CliExitData> {
        return new Promise<CliExitData>(async (resolve, reject) => {
            const cmdName = cmd.split(' ')[0];
            const odoLocation = await getToolLocation(cmdName);
            const finalCommand = cmd.replace(cmdName, odoLocation);
            odoChannel.print(finalCommand);
            childProcess.exec(finalCommand, opts, (error: Error, stdout: string, stderr: string) => {
                odoChannel.print(stdout);
                odoChannel.print(stderr);
                resolve({ error, stdout: stdout.replace(/---[\s\S]*---/g, '').trim(), stderr });
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
    let toolLocation = path.resolve(Platform.getUserHomePath(), '.vs-openshift', tools[cmd].cmdFileName);
    const toolDlLocation = path.resolve(Platform.getUserHomePath(), '.vs-openshift', tools[cmd].dlFileName);
    try {
        fs.accessSync(toolLocation);
    } catch (error) {
        const pathTool = which(cmd);
        if (pathTool === null) {
            await fsex.ensureDir(path.dirname(toolLocation));
            await vscode.window.withProgress({
                cancellable: true,
                location: vscode.ProgressLocation.Notification,
                title: `Downloading '${cmd}' tool: `
                }, (progress: vscode.Progress<{increment: number, message: string}>, token: vscode.CancellationToken) => {
                    return download.downloadFile(
                        tools[cmd].url,
                        toolDlLocation,
                        (dlProgress, increment) => {
                            progress.report({
                            increment,
                            message: `${dlProgress}%`
                        });
                    }
                );
            });
            if (toolDlLocation.endsWith('.zip') || toolDlLocation.endsWith('.tar.gz')) {
                await unzip(toolDlLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift'), tools[cmd].filePrefix);
            } else if ( toolDlLocation.endsWith('.gz')) {
                await unzip(toolDlLocation, toolLocation, tools[cmd].filePrefix);
            }
            if (process.platform !== 'win32') {
                fs.chmodSync(toolLocation, 0o765);
            }
        } else {
            toolLocation = cmd;
        }
    }
    return toolLocation;
}

function loadMetadata(requirements, platform) {
    const reqs = JSON.parse(JSON.stringify(requirements));
    for (const object in requirements) {
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

function unzip(zipFile, extractTo, prefix): Promise<any> {
    return new Promise((resolve, reject) => {
        if (zipFile.endsWith('.tar.gz')) {
            targz.decompress({
                src: zipFile,
                dest: extractTo,
                tar: {
                    map: (header) => {
                        if (prefix && header.name.startsWith(prefix)) {
                            header.name = header.name.substring(prefix.length);
                        }
                        return header;
                    }
                }
            }, (err)=> {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        } else if (zipFile.endsWith('.gz')) {
            gunzip(zipFile, extractTo)
                .then(resolve)
                .catch(reject);
        } else if (zipFile.endsWith('.zip')) {
            fs.createReadStream(zipFile)
                .pipe(unzipm.Extract({ path: extractTo }))
                .on('error', reject)
                .on('close', resolve);
        } else {
            reject(`unsupported extension for '${zipFile}'`);
        }
    });
  }

export function gunzip(source, destination): Promise<any> {
    return new Promise((res, rej) => {
        try {
            const dest = fs.createWriteStream(destination);
            fs.createReadStream(source).pipe(zlib.createGunzip()).pipe(dest);
            dest.on('close', res);
        } catch (err) {
            rej(err);
        }
    });
}

export const odoChannel = new OdoChannelImpl();
