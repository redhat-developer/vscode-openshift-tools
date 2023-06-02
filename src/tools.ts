/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { which } from 'shelljs';
import * as vscode from 'vscode';
import { CliChannel } from './cli';
import { Platform } from './util/platform';
import semver = require('semver');

import configData = require('./tools.json');

export class ToolsConfig {

    public static tools: any = ToolsConfig.loadMetadata(configData, Platform.OS);

    public static loadMetadata(requirements, platform): any {
        const reqs = JSON.parse(JSON.stringify(requirements));
        Object.keys(requirements).forEach((object) => {
            if (reqs[object].platform) {
                if (reqs[object].platform[platform]) {
                    Object.assign(reqs[object], reqs[object].platform[platform]);
                    delete reqs[object].platform;
                } else {
                    delete reqs[object];
                }
            }
        });
        return reqs;
    }

    public static resetConfiguration(): void {
        ToolsConfig.tools = ToolsConfig.loadMetadata(configData, Platform.OS);
    }

    public static async detect(cmd: string): Promise<string> {

        if (ToolsConfig.tools[cmd].location === undefined) {
            let toolCacheLocation = path.resolve(__dirname, '..', 'tools', Platform.OS, ToolsConfig.tools[cmd].cmdFileName);
            let toolLocations: string[] = [toolCacheLocation];
            if (process.env.REMOTE_CONTAINERS === 'true') {
                const openShiftToolsFolder = path.join(os.homedir(), '.local', 'state', 'vs-openshift-tools');
                if (fs.existsSync(path.join(openShiftToolsFolder, 'tools', cmd))) {
                    toolLocations = [path.join(openShiftToolsFolder, 'tools', cmd, cmd)];
                    toolCacheLocation = path.join(openShiftToolsFolder, 'tools-cache');
                }
            }
            if (vscode.workspace.getConfiguration('openshiftToolkit').get('searchForToolsInPath')) {
                const whichLocation = which(cmd);
                toolLocations.unshift(whichLocation && whichLocation.stdout);
            }

            ToolsConfig.tools[cmd].location =
                await ToolsConfig.selectTool(toolLocations, ToolsConfig.tools[cmd].versionRange).then(
                    (location) => {
                        if (location && Platform.OS !== 'win32') fs.chmodSync(location, 0o765);
                        return location;
                    }
                );
        }
        return ToolsConfig.tools[cmd].location;
    }

    public static async getVersion(location: string): Promise<string> {
        let detectedVersion: string;
        if (fs.existsSync(location)) {
            const result = await CliChannel.getInstance().execute(`"${location}" version --client`);
            if (result.stdout) {
                let trimmedText = result.stdout;
                if(location.indexOf('helm') !== -1) {
                    trimmedText = result.stdout.substring(0,trimmedText.indexOf(','));
                }
                const versionRegExp = /.*([0-9]+\.[0-9]+\.[0-9]+).*/;
                const toolVersion: string[] = trimmedText.trim().split('\n').filter((value) => {
                    return versionRegExp.test(value);
                }).map((value)=>versionRegExp.exec(value)[1]);
                if (toolVersion.length) {
                    [ detectedVersion ] = toolVersion;
                }
            }
        }
        return detectedVersion;
    }

    public static async selectTool(locations: string[], versionRange: string): Promise<string> {
        let result: string;
        // Array.find cannot be used here because of async calls
        // eslint-disable-next-line no-restricted-syntax
        for (const location of locations) {
            // eslint-disable-next-line no-await-in-loop
            if (location && semver.satisfies(await ToolsConfig.getVersion(location), versionRange)) {
                result = location;
                break;
            }
        }
        return result;
    }
}
