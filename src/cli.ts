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
        "version": "0.0.11",
        "dlFileName": "odo",
        "cmdFileName": "odo",
        "filePrefix": "",
        "platform": {
            "win32": {
                "url": "https://github.com/redhat-developer/odo/releases/download/v0.0.11/odo-windows-amd64.exe",
                "sha256sum": "",
                "dlFileName": "odo.exe",
                "cmdFileName": "odo.exe"
            },
            "darwin": {
                "url": "https://github.com/redhat-developer/odo/releases/download/v0.0.11/odo-darwin-amd64",
                "sha256sum": ""
            },
            "linux": {
                "url": "https://github.com/redhat-developer/odo/releases/download/v0.0.11/odo-linux-amd64",
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
        "filePrefix": "",
        "platform": {
            "win32": {
                "url": "https://github.com/openshift/origin/releases/download/v3.10.0/openshift-origin-client-tools-v3.10.0-dd10d17-windows.zip",
                "sha256sum": "",
                "dlFileName": "oc.zip",
                "cmdFileName": "oc.exe"
            },
            "darwin": {
                "url": "https://github.com/openshift/origin/releases/download/v3.10.0/openshift-origin-client-tools-v3.10.0-dd10d17-mac.zip",
                "sha256sum": "",
                "dlFileName": "oc.zip",
                "cmdFileName": "oc"
            },
            "linux": {
                "url": "https://github.com/openshift/origin/releases/download/v3.10.0/openshift-origin-client-tools-v3.10.0-dd10d17-linux-64bit.tar.gz",
                "sha256sum": "",
                "fileName": "oc.tar.gz",
                "dlFileName": "oc.tar.gz",
                "cmdFileName": "oc",
                "filePrefix": "openshift-origin-client-tools-v3.10.0-dd10d17-linux-64bit"
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
            let finalCommand = cmd.replace(cmdName, odoLocation);
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
    let toolDlLocation = path.resolve(Platform.getUserHomePath(), '.vs-openshift', tools[cmd].dlFileName);
    try {
        fs.accessSync(toolLocation);
    } catch (error) {
        let pathTool = which(cmd);
        if (pathTool === null) {
            await fsex.ensureDir(path.dirname(toolLocation));
            await vscode.window.withProgress({
                cancellable:true,
                location: vscode.ProgressLocation.Notification,
                title: `Downloading '${cmd}' tool: `
                }, (progress: vscode.Progress<{increment: number, message: string}>, token: vscode.CancellationToken) => {
                    return download.downloadFile(
                        tools[cmd].url,
                        toolDlLocation,
                        function (dlProgress, increment) {
                            progress.report({
                            increment   ,
                            message: `${dlProgress}%`
                        });
                    }
                );
            });            
                if (toolDlLocation.endsWith('.zip') || toolDlLocation.endsWith('.tar.gz')) {
                await unzip(toolDlLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift'), tools[cmd].filePrefix);
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

function unzip(zipFile, extractTo, prefix): Promise<any> {
    return new Promise((resolve, reject) => {

      if(zipFile.endsWith('.tar.gz')) {
        targz.decompress({
          src: zipFile,
          dest: extractTo,
          tar: {
            map: function(header) {
              if (prefix && header.name.startsWith(prefix)) {
                header.name = header.name.substring(prefix.length);
              }
              return header;
            }
          }
        }, (err)=> {
          if(err) {
            reject(err);
          } else {
            resolve(true);
          }
        });
      } else if(zipFile.endsWith('.zip')) {
        fs.createReadStream(zipFile).pipe(unzipm.Extract({ path: extractTo })).on('error', (error) => {
            reject(error);
          }).on('close', () => {
            resolve();
          });
      } else {
        reject(`unsupported extension for ${zipFile}`);
      }
    });
  }

export const odoChannel = new OdoChannelImpl();
