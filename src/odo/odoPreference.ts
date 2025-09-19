/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as path from 'path';
import { parse, stringify } from 'yaml';
import { TelemetryProps } from '../telemetry';
import { Platform } from '../util/platform';
import { YAML_STRINGIFY_OPTIONS } from '../util/utils';
import { Registry } from './componentType';


type OdoRegistryObject = {
    Name: string;
    URL: string;
    secure: boolean;
};

type OdoSettingsObject = {
    RegistryList: OdoRegistryObject[];
    ConsentTelemetry;
};

type OdoPreferenceObject = {
    kind: string,
    apiversion: string,
    OdoSettings: OdoSettingsObject;
};

export class OdoPreferenceError extends Error {
    constructor(message: string, public readonly telemetryMessage = message, public readonly parent?, public readonly telemetryProps: TelemetryProps = {}) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class OdoPreference {
    private static instance: OdoPreference;

    public static DEFAULT_DEVFILE_REGISTRY_NAME: string = 'DefaultDevfileRegistry';
    public static DEFAULT_DEVFILE_REGISTRY_URL: string = 'https://registry.devfile.io';
    public static DEFAULT_DEVFILE_REGISTRY_SECURE: boolean = false;

    private static DefaultOdoPreference: OdoPreferenceObject = {
        kind: 'Preference',
        apiversion: 'odo.dev/v1alpha1',
        OdoSettings: {
            RegistryList: [
                {
                    Name: OdoPreference.DEFAULT_DEVFILE_REGISTRY_NAME,
                    URL: OdoPreference.DEFAULT_DEVFILE_REGISTRY_URL,
                    secure: OdoPreference.DEFAULT_DEVFILE_REGISTRY_SECURE
                } as OdoRegistryObject
            ],
            ConsentTelemetry: false
        } as OdoSettingsObject
    };


    public static get Instance(): OdoPreference {
        if (!OdoPreference.instance) {
            OdoPreference.instance = new OdoPreference();
        }
        return OdoPreference.instance;
    }

    private getOdoPreferenceFile(): string {
        // This value can be provided to set a seperate directory for users 'homedir' resolution
        // note for mocking purpose ONLY
        const customHomeDir = Platform.ENV.CUSTOM_HOMEDIR;
        const configFileName = 'preference.yaml';

        if (customHomeDir && customHomeDir.length > 0) {
            return path.join(customHomeDir, '.odo', configFileName);
        }

        return path.join(Platform.getUserHomePath(), '.odo', configFileName);
    }

    public async getRegistries():  Promise<Registry[]> {
        const odoPreference = await this.readOdoPreference();
        return odoPreference.OdoSettings.RegistryList.map((r) => {
            return {
                name: r.Name,
                url: r.URL,
                secure: r.secure } as Registry;
        });
    }

    public async addRegistry(name: string, url: string, token: string): Promise<Registry> {
        const odoPreference = await this.readOdoPreference();
        odoPreference.OdoSettings.RegistryList.push({
            Name: name,
            URL: url,
            secure: !!token
        } as never);
        await this.writeOdoPreference(odoPreference);
        return {
            name,
            secure: !!token,
            url,
        };
    }

    public async removeRegistry(name: string): Promise<void> {
        const odoPreference = await this.readOdoPreference();
        odoPreference.OdoSettings.RegistryList.splice(
            odoPreference.OdoSettings.RegistryList.findIndex((registry) => registry.Name === name), 1
        );
        await this.writeOdoPreference(odoPreference);
    }

    private async readOdoPreference():  Promise<OdoPreferenceObject> {
        let mergedPreference = OdoPreference.DefaultOdoPreference;
        const odoPreferenceFilePath = this.getOdoPreferenceFile();
        let isToBeReWritten: boolean = false;
        try {
            const odoPreferenceFile = await fs.readFile(odoPreferenceFilePath, 'utf8');
            const odoPreferences = parse(odoPreferenceFile) as OdoPreferenceObject;

            // If `odoPreferences.OdoSettings.RegistryList` is `null` or doesn't contain any registry item
            // we should recover the 'DefaultDevfileRegistry` item on it
            if (!odoPreferences.OdoSettings.RegistryList || odoPreferences.OdoSettings.RegistryList.length === 0) {
                odoPreferences.OdoSettings.RegistryList = OdoPreference.DefaultOdoPreference.OdoSettings.RegistryList;
                isToBeReWritten = true;
            }

            mergedPreference = { ...mergedPreference, ...odoPreferences };
        } catch {
            isToBeReWritten = true;
        }

        if(isToBeReWritten) {
            await this.writeOdoPreference(mergedPreference);
        }

        return mergedPreference;
    }

    private async dirExists(path: string): Promise<boolean> {
        try {
            if ((await fs.stat(path)).isDirectory()) {
                return true;
            }
        } catch {
            // Ignore
        }
        return false;
    }

    private async writeOdoPreference(preference: any):  Promise<any> {
        const odoPreferenceFilePath = this.getOdoPreferenceFile();
        try {
            const preferenceYaml = stringify(preference, YAML_STRINGIFY_OPTIONS);
            const odoPreferenceDir = path.parse(odoPreferenceFilePath).dir;
            if (!await this.dirExists(odoPreferenceDir)) {
                await fs.mkdir(odoPreferenceDir, { recursive: true, mode: 0o750} );
            }
            await fs.writeFile(this.getOdoPreferenceFile(), preferenceYaml, 'utf8');
        } catch (err) {
            throw new OdoPreferenceError(
                `An error occured while creating the ODO Preference file at ${odoPreferenceFilePath}!`,
                `Error when creating the ODO Preference file: ${odoPreferenceFilePath}`,
                err
            );
        }
    }
}
