/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { which } from "shelljs";
import { Platform } from "./util/platform";
import { CliChannel } from './cli';

import semver = require('semver');
import configData = require('./tools.json');

export class ToolsConfig {

    public static tools: object = ToolsConfig.loadMetadata(configData, Platform.OS);

    public static loadMetadata(requirements, platform): object {
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

        let toolLocation: string = ToolsConfig.tools[cmd].location;

        if (toolLocation === undefined) {
            const toolCacheLocation = path.resolve(__dirname, '..', 'tools', Platform.OS, ToolsConfig.tools[cmd].cmdFileName);
            const toolLocations: string[] = [toolCacheLocation];
            if (vscode.workspace.getConfiguration("openshiftConnector").get("searchForToolsInPath")) {
                const whichLocation = which(cmd);
                toolLocations.unshift(whichLocation && whichLocation.stdout);
            }

            toolLocation = await ToolsConfig.selectTool(toolLocations, ToolsConfig.tools[cmd].versionRange);
            if (toolLocation && Platform.OS !== 'win32') fs.chmodSync(toolLocation, 0o765);
        }
        return toolLocation;
    }

    public static async getVersion(location: string, cmd: string = path.parse(location).name): Promise<string> {
        let detectedVersion: string;
        if (fs.existsSync(location)) {
            const version = new RegExp(`${cmd.toLocaleLowerCase()} v((([0-9]+)\\.([0-9]+)\\.([0-9]+)(?:-([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?)(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?).*`);
            const result = await CliChannel.getInstance().execute(`"${location}" version`);
            if (result.stdout) {
                const toolVersion: string[] = result.stdout.trim().split('\n').filter((value) => {
                    return version.test(value);
                }).map((value)=>version.exec(value)[1]);
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
