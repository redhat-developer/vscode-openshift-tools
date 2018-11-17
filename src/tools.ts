/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Platform } from "./util/platform";
import * as archive from "./util/archive";
import { which } from "shelljs";
import { DownloadUtil } from "./util/download";
import hasha = require("hasha");
import opn = require("opn");
import * as vscode from 'vscode';
import * as path from 'path';
import * as fsex from 'fs-extra';
import * as fs from 'fs';
import { Cli } from './cli';

const configData = {
    odo: {
        description: "OpenShift Do CLI tool",
        vendor: "Red Hat, Inc.",
        name: "odo",
        version: "0.0.15",
        dlFileName: "odo",
        cmdFileName: "odo",
        filePrefix: "",
        platform: {
            win32: {
                url: "https://github.com/redhat-developer/odo/releases/download/v0.0.15/odo-windows-amd64.exe.gz",
                sha256sum: "66b5b05e7257611209f875782c83883b8a979770cd5e336338b397d70d631348",
                dlFileName: "odo-windows-amd64.exe.gz",
                cmdFileName: "odo.exe"
            },
            darwin: {
                url: "https://github.com/redhat-developer/odo/releases/download/v0.0.15/odo-darwin-amd64.gz",
                sha256sum: "fc705718ce34867f850d7f6ac639b58d207ac1a9801cfed93e760628bf0623c9",
                dlFileName: "odo-darwin-amd64.gz"
            },
            linux: {
                url: "https://github.com/redhat-developer/odo/releases/download/v0.0.15/odo-linux-amd64.gz",
                sha256sum: "ee74b8a301245b98fce94954739df10cf0fbf1220a1167d2614205393d63c01b",
                dlFileName: "odo-linux-amd64.gz"
            }
        }
    },
    oc: {
        description: "OKD CLI client tool",
        vendor: "Red Hat, Inc.",
        name: "oc",
        cmdFileName: "oc",
        version: "3.9.0",
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

export class ToolsConfig {

    public static tools: object = ToolsConfig.loadMetadata(configData, Platform.OS);

    public static loadMetadata(requirements, platform): object {
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

    public static resetConfiguration() {
        ToolsConfig.tools = ToolsConfig.loadMetadata(configData, Platform.OS);
    }

    public static async detectOrDownload(cmd: string): Promise<string> {

        let toolLocation:string = ToolsConfig.tools[cmd].location;

        if (toolLocation === undefined) {
            const toolCacheLocation = path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools[cmd].cmdFileName);
            let toolLocations: string[] = [which(cmd), toolCacheLocation];
            toolLocation = await ToolsConfig.selectTool(toolLocations, ToolsConfig.tools[cmd].version);

            if(toolLocation === undefined) {
                // otherwise request permission to download
                const toolDlLocation = path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools[cmd].dlFileName);
                const response = await vscode.window.showInformationMessage(
                    `Cannot find ${ToolsConfig.tools[cmd].description} v${ToolsConfig.tools[cmd].version}.`, 'Download and install', 'Help', 'Cancel');
                fsex.ensureDirSync(path.resolve(Platform.getUserHomePath(), '.vs-openshift'));
                if (response === 'Download and install') {
                    let action: string;
                    do {
                        action = undefined;
                        await vscode.window.withProgress({
                            cancellable: true,
                            location: vscode.ProgressLocation.Notification,
                            title: `Downloading ${ToolsConfig.tools[cmd].description}: `
                            },
                            (progress: vscode.Progress<{increment: number, message: string}>, token: vscode.CancellationToken) => {
                                return DownloadUtil.downloadFile(
                                    ToolsConfig.tools[cmd].url,
                                    toolDlLocation,
                                    (dlProgress, increment) => progress.report({ increment, message: `${dlProgress}%`})
                                );
                        });
                        const sha256sum: string = await hasha.fromFile(toolDlLocation, {algorithm: 'sha256'});
                        if (sha256sum !== ToolsConfig.tools[cmd].sha256sum) {
                            fsex.removeSync(toolDlLocation);
                            action = await vscode.window.showInformationMessage(`Checksum for downloaded ${ToolsConfig.tools[cmd].description} v${ToolsConfig.tools[cmd].version} is not correct.`, 'Download again', 'Cancel');
                        }

                    } while (action === 'Download again');

                    if (action !== 'Cancel') {
                        if (toolDlLocation.endsWith('.zip') || toolDlLocation.endsWith('.tar.gz')) {
                            await archive.unzip(toolDlLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift'), ToolsConfig.tools[cmd].filePrefix);
                        } else if (toolDlLocation.endsWith('.gz')) {
                            await archive.unzip(toolDlLocation, toolCacheLocation, ToolsConfig.tools[cmd].filePrefix);
                        }
                        if (Platform.OS !== 'win32') {
                            fs.chmodSync(toolCacheLocation, 0o765);  
                        }
                        toolLocation = toolCacheLocation;
                    } 
                } else if (response === `Help`) {
                    opn('https://github.com/redhat-developer/vscode-openshift-tools#dependencies');
                }
            }
            if(toolLocation) {
                ToolsConfig.tools[cmd].location = toolLocation;
            }
        }
        return toolLocation;
    }

    public static async getVersion(location: string, cmd: string = path.parse(location).name): Promise<string> {
        let detectedVersion: string;
        if (fs.existsSync(location)) {
            const version = new RegExp(`${cmd} v([\\d\\.]+)`);
            try {
                const result = await Cli.getInstance().execute(`${location} version`);
                if (!result.error) { 
                    const toolVersion: string[] = result.stdout.trim().split('\n').filter((value) => {
                        return value.match(version);
                    }).map((value)=>version.exec(value)[1]);
                    if (toolVersion.length) {
                        detectedVersion = toolVersion[0];
                    }
                }
            } catch (ignore) {
                // if `${tool} version` failed, then there is no tool at specified location
            }
        }
        return detectedVersion;
    }

    public static async selectTool(locations: string[], correctVersion: string): Promise<string> {
        let result;
        for (const location of locations) {
            if(location && await ToolsConfig.getVersion(location) === correctVersion) {
                result = location;
                break;
            }
        }
        return result;
    }
}