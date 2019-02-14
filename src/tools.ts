/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Platform } from "./util/platform";
import { Archive } from "./util/archive";
import { which } from "shelljs";
import { DownloadUtil } from "./util/download";
import hasha = require("hasha");
import opn = require("opn");
import * as vscode from 'vscode';
import * as path from 'path';
import * as fsex from 'fs-extra';
import * as fs from 'fs';
import { Cli } from './cli';
import semver = require('semver');

const configData = {
    odo: {
        description: "OpenShift Do CLI tool",
        vendor: "Red Hat, Inc.",
        name: "odo",
        version: "0.0.19",
        versionRange: "0.0.19",
        versionRangeLabel: "v0.0.19",
        dlFileName: "odo",
        cmdFileName: "odo",
        filePrefix: "",
        platform: {
            win32: {
                url: "https://github.com/redhat-developer/odo/releases/download/v0.0.19/odo-windows-amd64.exe.gz",
                sha256sum: "a8582136de4ec61d6d53055899e07efabd674ab0f7f863adc8c7a0ef94f86f88",
                dlFileName: "odo-windows-amd64.exe.gz",
                cmdFileName: "odo.exe"
            },
            darwin: {
                url: "https://github.com/redhat-developer/odo/releases/download/v0.0.19/odo-darwin-amd64.gz",
                sha256sum: "6163e66e1a03b8b0bae1751e10849b5c22615f21ce372fadf122077a501c15a5",
                dlFileName: "odo-darwin-amd64.gz"
            },
            linux: {
                url: "https://github.com/redhat-developer/odo/releases/download/v0.0.19/odo-linux-amd64.gz",
                sha256sum: "1d804363de957c6ac36fd6d044303ada67e5a062b1b4eb64a6aa7a2a32435e53",
                dlFileName: "odo-linux-amd64.gz"
            }
        }
    },
    oc: {
        description: "OKD CLI client tool",
        vendor: "Red Hat, Inc.",
        name: "oc",
        cmdFileName: "oc",
        version: "3.11.0",
        versionRange: "^3.11.0",
        versionRangeLabel: "version >= 3.11.0 and < 4.0.0",
        filePrefix: "",
        platform: {
            win32: {
                url: "https://github.com/openshift/origin/releases/download/v3.11.0/openshift-origin-client-tools-v3.11.0-0cbc58b-windows.zip",
                sha256sum: "cdb84cc0000d0f0983120f903b2cad7114527ce2a9c4eb1988986eda7b877bfa",
                dlFileName: "oc.zip",
                cmdFileName: "oc.exe"
            },
            darwin: {
                url: "https://github.com/openshift/origin/releases/download/v3.11.0/openshift-origin-client-tools-v3.11.0-0cbc58b-mac.zip",
                sha256sum: "75d58500aec1a2cee9473dfa826c81199669dbc0f49806e31a13626b5e4cfcf0",
                dlFileName: "oc.zip",
            },
            linux: {
                url: "https://github.com/openshift/origin/releases/download/v3.11.0/openshift-origin-client-tools-v3.11.0-0cbc58b-linux-64bit.tar.gz",
                sha256sum: "4b0f07428ba854174c58d2e38287e5402964c9a9355f6c359d1242efd0990da3",
                fileName: "oc.tar.gz",
                dlFileName: "oc.tar.gz",
                filePrefix: "openshift-origin-client-tools-v3.11.0-0cbc58b-linux-64bit"
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

        let toolLocation: string = ToolsConfig.tools[cmd].location;

        if (toolLocation === undefined) {
            const toolCacheLocation = path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools[cmd].cmdFileName);
            const whichLocation = which(cmd);
            const toolLocations: string[] = [whichLocation ? whichLocation.stdout : null, toolCacheLocation];
            toolLocation = await ToolsConfig.selectTool(toolLocations, ToolsConfig.tools[cmd].versionRange);

            if (toolLocation === undefined) {
                // otherwise request permission to download
                const toolDlLocation = path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools[cmd].dlFileName);
                const installRequest = `Download and install v${ToolsConfig.tools[cmd].version}`;
                const response = await vscode.window.showInformationMessage(
                    `Cannot find ${ToolsConfig.tools[cmd].description} ${ToolsConfig.tools[cmd].versionRangeLabel}.`, installRequest, 'Help', 'Cancel');
                fsex.ensureDirSync(path.resolve(Platform.getUserHomePath(), '.vs-openshift'));
                if (response === installRequest) {
                    let action: string;
                    do {
                        action = undefined;
                        await vscode.window.withProgress({
                            cancellable: true,
                            location: vscode.ProgressLocation.Notification,
                            title: `Downloading ${ToolsConfig.tools[cmd].description}`
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
                            await Archive.unzip(toolDlLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift'), ToolsConfig.tools[cmd].filePrefix);
                        } else if (toolDlLocation.endsWith('.gz')) {
                            await Archive.unzip(toolDlLocation, toolCacheLocation, ToolsConfig.tools[cmd].filePrefix);
                        }
                        fsex.removeSync(toolDlLocation);
                        if (Platform.OS !== 'win32') {
                            fs.chmodSync(toolCacheLocation, 0o765);
                        }
                        toolLocation = toolCacheLocation;
                    }
                } else if (response === `Help`) {
                    opn('https://github.com/redhat-developer/vscode-openshift-tools#dependencies');
                }
            }
            if (toolLocation) {
                ToolsConfig.tools[cmd].location = toolLocation;
            }
        }
        return toolLocation;
    }

    public static async getVersion(location: string, cmd: string = path.parse(location).name): Promise<string> {
        let detectedVersion: string;
        if (fs.existsSync(location)) {
            const version = new RegExp(`${cmd} v([\\d\\.]+)`);
            const result = await Cli.getInstance().execute(`"${location}" version`);
            if (result.stdout) {
                const toolVersion: string[] = result.stdout.trim().split('\n').filter((value) => {
                    return value.match(version);
                }).map((value)=>version.exec(value)[1]);
                if (toolVersion.length) {
                    detectedVersion = toolVersion[0];
                }
            }
        }
        return detectedVersion;
    }

    public static async selectTool(locations: string[], versionRange: string): Promise<string> {
        let result;
        for (const location of locations) {
            if (location && semver.satisfies(await ToolsConfig.getVersion(location), versionRange)) {
                result = location;
                break;
            }
        }
        return result;
    }
}
