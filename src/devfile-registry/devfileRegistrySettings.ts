/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from 'yaml';
import { Platform } from '../util/platform';
import {
    DEFAULT_DEVFILE_REGISTRY_NAME,
    DEFAULT_DEVFILE_REGISTRY_SECURE,
    DEFAULT_DEVFILE_REGISTRY_URL,
    DevfileRegistryInfo
} from './devfileInfo';

const CONFIG_SECTION = 'openshiftToolkit';
const CONFIG_KEY = 'devfileRegistries';

type OdoRegistryObject = {
    Name: string;
    URL: string;
    secure: boolean;
};

type OdoSettingsObject = {
    RegistryList: OdoRegistryObject[];
};

type OdoPreferenceObject = {
    OdoSettings: OdoSettingsObject;
};

/**
 * Manages the devfile registry list in the `openshiftToolkit.devfileRegistries`
 * user setting.
 */
export class DevfileRegistrySettings {
    private static instance: DevfileRegistrySettings;

    // Aliases for the constants defined in devfileInfo.ts, which is loadable
    // outside the VS Code extension host (unlike this module, which imports
    // 'vscode'); see DEFAULT_DEVFILE_REGISTRY_NAME there for the source of truth.
    public static readonly DEFAULT_DEVFILE_REGISTRY_NAME = DEFAULT_DEVFILE_REGISTRY_NAME;
    public static readonly DEFAULT_DEVFILE_REGISTRY_URL = DEFAULT_DEVFILE_REGISTRY_URL;
    public static readonly DEFAULT_DEVFILE_REGISTRY_SECURE = DEFAULT_DEVFILE_REGISTRY_SECURE;

    private static readonly DEFAULT_REGISTRIES: DevfileRegistryInfo[] = [
        {
            name: DevfileRegistrySettings.DEFAULT_DEVFILE_REGISTRY_NAME,
            url: DevfileRegistrySettings.DEFAULT_DEVFILE_REGISTRY_URL,
            secure: DevfileRegistrySettings.DEFAULT_DEVFILE_REGISTRY_SECURE
        }
    ];

    public static get Instance(): DevfileRegistrySettings {
        if (!DevfileRegistrySettings.instance) {
            DevfileRegistrySettings.instance = new DevfileRegistrySettings();
        }
        return DevfileRegistrySettings.instance;
    }

    public async getRegistries(): Promise<DevfileRegistryInfo[]> {
        // 'vscode' is imported lazily so that this module stays loadable under
        // plain Node, where the UI tests resolve it outside the extension host
        const { workspace } = await import('vscode');
        const registries = workspace.getConfiguration(CONFIG_SECTION).get<DevfileRegistryInfo[]>(CONFIG_KEY);
        return registries ?? DevfileRegistrySettings.DEFAULT_REGISTRIES;
    }

    public async addRegistry(name: string, url: string, token: string): Promise<DevfileRegistryInfo> {
        const registries = await this.getRegistries();
        const newRegistry: DevfileRegistryInfo = {
            name,
            url,
            secure: !!token
        };
        registries.unshift(newRegistry);
        await this.saveRegistries(registries);
        return newRegistry;
    }

    public async removeRegistry(name: string): Promise<void> {
        const registries = await this.getRegistries();
        const index = registries.findIndex((registry) => registry.name === name);
        if (index !== -1) {
            registries.splice(index, 1);
            await this.saveRegistries(registries);
        }
    }

    public async resolveRegistryUrl(registry?: string): Promise<string> {
        if (!registry) {
            return DevfileRegistrySettings.DEFAULT_DEVFILE_REGISTRY_URL;
        }

        const registries = await this.getRegistries();
        const match = registries.find((r) => r.name === registry);

        if (!match) {
            throw new Error(`Unknown registry name: ${registry}`);
        }

        return match.url;
    }

    /**
     * One-time migration of the registry list from the odo preference file
     * (`~/.odo/preference.yaml`) into the `openshiftToolkit.devfileRegistries`
     * setting. Does nothing when the setting already has a user value, so it is
     * safe to call on every activation.
     */
    public async migrateFromOdoPreference(): Promise<void> {
        try {
            const { workspace } = await import('vscode');
            const inspect = workspace.getConfiguration(CONFIG_SECTION).inspect<DevfileRegistryInfo[]>(CONFIG_KEY);
            if (inspect?.globalValue !== undefined) {
                return; // already migrated or configured by the user
            }

            const odoRegistries = await this.readOdoPreferenceRegistries();
            if (!odoRegistries || odoRegistries.length === 0) {
                return; // nothing to migrate, defaults apply
            }

            const registries: DevfileRegistryInfo[] = odoRegistries.map((r) => ({
                name: r.Name,
                url: r.URL,
                secure: r.secure
            }));
            await this.saveRegistries(registries);
        } catch {
            // migration is best-effort; defaults apply on any failure
        }
    }

    private async readOdoPreferenceRegistries(): Promise<OdoRegistryObject[] | undefined> {
        // This value can be provided to set a separate directory for the user 'homedir' resolution
        // note for mocking purpose ONLY
        const customHomeDir = Platform.ENV.CUSTOM_HOMEDIR;
        const homeDir = customHomeDir && customHomeDir.length > 0 ? customHomeDir : Platform.getUserHomePath();
        const odoPreferenceFilePath = path.join(homeDir, '.odo', 'preference.yaml');

        const odoPreferenceFile = await fs.readFile(odoPreferenceFilePath, 'utf8');
        const odoPreferences = parse(odoPreferenceFile) as OdoPreferenceObject;
        return odoPreferences?.OdoSettings?.RegistryList;
    }

    private async saveRegistries(registries: DevfileRegistryInfo[]): Promise<void> {
        const { workspace, ConfigurationTarget } = await import('vscode');
        await workspace.getConfiguration(CONFIG_SECTION).update(CONFIG_KEY, registries, ConfigurationTarget.Global);
    }
}
