/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

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
import * as zlib from 'zlib';
import * as opn from 'opn';
import hasha = require('hasha');
import { ExecException } from 'child_process';

export interface CliExitData {
    readonly error: ExecException;
    readonly stdout: string;
    readonly stderr: string;
}

const toolsConfig = {
    odo: {
        description: "OpenShift Do CLI tool",
        vendor: "Red Hat, Inc.",
        name: "odo",
        version: "0.0.14",
        dlFileName: "odo",
        cmdFileName: "odo",
        filePrefix: "",
        platform: {
            win32: {
                url: "https://github.com/redhat-developer/odo/releases/download/v0.0.14/odo-windows-amd64.exe.gz",
                sha256sum: "ccd8a929e6585a48f79d144ec871b6e5684252fcfa91f67e6e5e8ebbac91f7d7",
                dlFileName: "odo-windows-amd64.exe.gz",
                cmdFileName: "odo.exe"
            },
            darwin: {
                url: "https://github.com/redhat-developer/odo/releases/download/v0.0.14/odo-darwin-amd64.gz",
                sha256sum: "43812cc02f42819db6f00b325374d6e8992e2484bb0e805a32146bbd169842ab",
                dlFileName: "odo-darwin-amd64.gz"
            },
            linux: {
                url: "https://github.com/redhat-developer/odo/releases/download/v0.0.14/odo-linux-amd64.gz",
                sha256sum: "743c066fb772eb86231a78abd494618c802180fd9666b191e1ccd54fa1ee80ac",
                dlFileName: "odo-linux-amd64.gz"
            }
        }
    },
    oc: {
        description: "OKD CLI client tool",
        vendor: "Red Hat, Inc.",
        name: "oc",
        cmdFileName: "oc",
        version: "0.0.10",
        filePrefix: "",
        platform: {
            win32: {
                url: "https://github.com/openshift/origin/releases/download/v3.9.0/openshift-origin-client-tools-v3.9.0-191fece-windows.zip",
                sha256sum: "705eb110587fdbd244fbb0f93146a643b24295cfe2410ff9fe67a0e880912663",
                dlFileName: "oc.zip",
                cmdFileName: "oc.exe"
            },
            darwin: {
                url: "https://github.com/openshift/origin/releases/download/v3.9.0/openshift-origin-client-tools-v3.9.0-191fece-mac.zip",
                sha256sum: "32bdd9464866c8e93d8cf4a3a7718b0bc9fa0f2881f045b97997fa014b52a40b",
                dlFileName: "oc.zip",
            },
            linux: {
                url: "https://github.com/openshift/origin/releases/download/v3.9.0/openshift-origin-client-tools-v3.9.0-191fece-linux-64bit.tar.gz",
                sha256sum: "6ed2fb1579b14b4557e4450a807c97cd1b68a6c727cd1e12deedc5512907222e",
                fileName: "oc.tar.gz",
                dlFileName: "oc.tar.gz",
                filePrefix: "openshift-origin-client-tools-v3.9.0-191fece-linux-64bit"
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
            if(opts.maxBuffer === undefined) {
                opts.maxBuffer = 2*1024*1024;
            }
            childProcess.exec(finalCommand, opts, (error: ExecException, stdout: string, stderr: string) => {
                odoChannel.print(stdout);
                odoChannel.print(stderr);
                if (error) {
                    if (error.code === 1 && cmdName ==='odo') {
                        resolve({ error, stdout: stdout.replace(/---[\s\S]*---/g, '').trim(), stderr });
                    } else {
                        reject(error);
                    }
                } else {
                    resolve({ error, stdout: stdout.replace(/---[\s\S]*---/g, '').trim(), stderr });
                }
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
    private readonly channel: vscode.OutputChannel = vscode.window.createOutputChannel("OpenShift");
    print(text: string) {
        this.channel.append(text);
        if (text.charAt(text.length - 1) !== '\n') {
            this.channel.append('\n');
        }
        if (vscode.workspace.getConfiguration('openshiftConnector').get<boolean>('showChannelOnOutput')) {
            this.channel.show();
        }
    }
}

async function getToolLocation(cmd): Promise<string> {
    let toolLocation = path.resolve(Platform.getUserHomePath(), '.vs-openshift', tools[cmd].cmdFileName);
    const toolDlLocation = path.resolve(Platform.getUserHomePath(), '.vs-openshift', tools[cmd].dlFileName);
    const pathTool = which(cmd);
    if (pathTool === null) {
        try {
            fs.accessSync(toolLocation);
        } catch (error) {
            const response = await vscode.window.showInformationMessage(
                `Cannot find ${tools[cmd].description}.`, 'Download and install', 'Help', 'Cancel');
            if (response === 'Download and install') {
                await fsex.ensureDir(path.dirname(toolLocation));
                let action: string = "Continue";
                do {
                    await vscode.window.withProgress({
                        cancellable: true,
                        location: vscode.ProgressLocation.Notification,
                        title: `Downloading ${tools[cmd].description}: `
                        },
                        (progress: vscode.Progress<{increment: number, message: string}>, token: vscode.CancellationToken) => {
                            return download.downloadFile(
                                tools[cmd].url,
                                toolDlLocation,
                                (dlProgress, increment) => progress.report({ increment, message: `${dlProgress}%`})
                            );
                    });
                    if (tools[cmd].sha256sum && tools[cmd].sha256sum !== "") {
                        const sha256sum: string = await hasha.fromFile(toolDlLocation, {algorithm: 'sha256'});
                        if (sha256sum !== tools[cmd].sha256sum) {
                            fsex.removeSync(toolDlLocation);
                            action = await vscode.window.showInformationMessage(`Checksum for downloaded ${tools[cmd].description} is not correct.`, 'Download again', 'Cancel');
                        }
                    } else {
                        action = 'Continue';
                    }
                } while (action === 'Download again');

                if (action === 'Continue') {
                    if (toolDlLocation.endsWith('.zip') || toolDlLocation.endsWith('.tar.gz')) {
                        await unzip(toolDlLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift'), tools[cmd].filePrefix);
                    } else if (toolDlLocation.endsWith('.gz')) {
                        await unzip(toolDlLocation, toolLocation, tools[cmd].filePrefix);
                    }
                    if (process.platform !== 'win32') {
                        fs.chmodSync(toolLocation, 0o765);
                    }
                }
            } else if (response === `Help`) {
                opn('https://github.com/redhat-developer/vscode-openshift-tools#dependencies');
            }
        }
    } else {
        toolLocation = cmd;
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
                        prefix && header.name.startsWith(prefix) ? header.name = header.name.substring(prefix.length) : header;
                        return header;
                    }
                }
            }, (err)=> {
                err ? reject(err) : resolve();
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
