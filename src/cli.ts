/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import * as path from 'path';
import { DownloadUtil } from './util/download';
import * as fsex from 'fs-extra';
import { which } from 'shelljs';
import * as fs from 'fs';
import { Platform } from './util/platform';
import targz = require('targz');
import unzipm = require('unzip-stream');
import * as zlib from 'zlib';
import opn = require('opn');
import hasha = require('hasha');
import { ExecException } from 'child_process';
import { toolsConfig } from './toolsConfig';

export interface CliExitData {
    readonly error: ExecException;
    readonly stdout: string;
    readonly stderr: string;
}

export class Cli implements ICli {
    private static instance: Cli;
    private tools: object = this.loadMetadata(toolsConfig, process.platform);
    private odoChannel: OdoChannel = new OdoChannelImpl();

    private constructor() {}

    static getInstance(): Cli {
        if (!Cli.instance) {
            Cli.instance = new Cli();
        }
        return Cli.instance;
    }

    async execute(cmd: string, opts: any = {}): Promise<CliExitData> {
        return new Promise<CliExitData>(async (resolve, reject) => {
            const cmdName = cmd.split(' ')[0];
            const odoLocation = await this.getToolLocation(cmdName);
            const finalCommand = cmd.replace(new RegExp(cmdName), odoLocation).replace(new RegExp(`&& ${cmdName}`, 'g'), `&& ${odoLocation}`);
            this.odoChannel.print(finalCommand);
            if (opts.maxBuffer === undefined) {
                opts.maxBuffer = 2*1024*1024;
            }
            childProcess.exec(finalCommand, opts, (error: ExecException, stdout: string, stderr: string) => {
                this.odoChannel.print(stdout);
                this.odoChannel.print(stderr);
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

    private async getToolLocation(cmd: string): Promise<string> {
        let toolLocation = path.resolve(Platform.getUserHomePath(), '.vs-openshift', this.tools[cmd].cmdFileName);
        const toolDlLocation = path.resolve(Platform.getUserHomePath(), '.vs-openshift', this.tools[cmd].dlFileName);
        const pathTool = which(cmd);
        if (pathTool === null) {
            try {
                fs.accessSync(toolLocation);
            } catch (error) {
                const response = await vscode.window.showInformationMessage(
                    `Cannot find ${this.tools[cmd].description}.`, 'Download and install', 'Help', 'Cancel');
                if (response === 'Download and install') {
                    await fsex.ensureDir(path.dirname(toolLocation));
                    let action: string = "Continue";
                    do {
                        await vscode.window.withProgress({
                            cancellable: true,
                            location: vscode.ProgressLocation.Notification,
                            title: `Downloading ${this.tools[cmd].description}: `
                            },
                            (progress: vscode.Progress<{increment: number, message: string}>, token: vscode.CancellationToken) => {
                                return DownloadUtil.downloadFile(
                                    this.tools[cmd].url,
                                    toolDlLocation,
                                    (dlProgress, increment) => progress.report({ increment, message: `${dlProgress}%`})
                                );
                        });
                        if (this.tools[cmd].sha256sum && this.tools[cmd].sha256sum !== "") {
                            const sha256sum: string = await hasha.fromFile(toolDlLocation, {algorithm: 'sha256'});
                            if (sha256sum !== this.tools[cmd].sha256sum) {
                                fsex.removeSync(toolDlLocation);
                                action = await vscode.window.showInformationMessage(`Checksum for downloaded ${this.tools[cmd].description} is not correct.`, 'Download again', 'Cancel');
                            }
                        } else {
                            action = 'Continue';
                        }
                    } while (action === 'Download again');

                    if (action === 'Continue') {
                        if (toolDlLocation.endsWith('.zip') || toolDlLocation.endsWith('.tar.gz')) {
                            await this.unzip(toolDlLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift'), this.tools[cmd].filePrefix);
                        } else if (toolDlLocation.endsWith('.gz')) {
                            await this.unzip(toolDlLocation, toolLocation, this.tools[cmd].filePrefix);
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

    private loadMetadata(requirements, platform): object {
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

    private unzip(zipFile, extractTo, prefix): Promise<void> {
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
                this.gunzip(zipFile, extractTo)
                    .then(resolve)
                    .catch(reject);
            } else if (zipFile.endsWith('.zip')) {
                fs.createReadStream(zipFile)
                    .pipe(unzipm.Extract({ path: extractTo }))
                    .on('error', reject)
                    .on('close', resolve);
            } else {
                reject(`Unsupported extension for '${zipFile}'`);
            }
        });
    }

    private gunzip(source, destination): Promise<void> {
        return new Promise((res, rej) => {
            const src = fs.createReadStream(source);
            const dest = fs.createWriteStream(destination);
            src.pipe(zlib.createGunzip()).pipe(dest);
            dest.on('close', res);
            dest.on('error', rej);
            src.on('error', rej);
        });
    }
}

export interface ICli {
    execute(cmd: string, opts: any): Promise<CliExitData>;
}

export interface OdoChannel {
    print(text: string): void;
}

class OdoChannelImpl implements OdoChannel {
    private readonly channel: vscode.OutputChannel = vscode.window.createOutputChannel("OpenShift");
    print(text: string): void {
        this.channel.append(text);
        if (text.charAt(text.length - 1) !== '\n') {
            this.channel.append('\n');
        }
        if (vscode.workspace.getConfiguration('openshiftConnector').get<boolean>('showChannelOnOutput')) {
            this.channel.show();
        }
    }
}
