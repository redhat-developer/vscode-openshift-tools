/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as https from 'https';
import * as YAML from 'js-yaml';
import { ExecutionContext } from '../cli';
import { Registry } from '../odo/componentType';
import { OdoPreference } from '../odo/odoPreference';
import { DevfileData, DevfileInfo } from './devfileInfo';

export const DEVFILE_VERSION_LATEST: string = 'latest';

/**
 * Wraps some the Devfile Registry REST API calls.
 */
export class DevfileRegistry {
    private static instance: DevfileRegistry;

    private executionContext: ExecutionContext = new ExecutionContext();

    public static get Instance(): DevfileRegistry {
        if (!DevfileRegistry.instance) {
            DevfileRegistry.instance = new DevfileRegistry();
        }
        return DevfileRegistry.instance;
    }

    private constructor() {
        // no state
    }

    /**
     * Get list of Devfile Infos from the specified Registry.
     *
     * GET http://{registry host}/v2index/all
     *
     * @param url Devfile Registry URL
     * @param abortTimeout (Optional) If provided, allow cancelling the operation by timeout
     * @param abortController (Optional) If provided, allows cancelling the operation by signal
     */
    public async getDevfileInfoList(url: string, abortTimeout?: number, abortController?: AbortController): Promise<DevfileInfo[]> {
        const requestUrl = `${url}/v2index/all`;
        const key = ExecutionContext.key(requestUrl);
        if (this.executionContext && this.executionContext.has(key)) {
            return this.executionContext.get(key);
        }
        const rawList = await DevfileRegistry._get(`${url}/v2index/all`, abortTimeout, abortController);
        const jsonList = JSON.parse(rawList);
        this.executionContext.set(key, jsonList);
        return jsonList;
    }

    /**
     * Get Devfile of specified version from Registry.
     *
     * GET http://{registry host}/devfiles/{stack}/{version}
     *
     * @param url Devfile Registry URL
     * @param stack Devfile stack
     * @param version (Optional) If specified, the version of Devfile to be received, otherwize 'latest' version is requested
     * @param abortTimeout (Optional) If provided, allow cancelling the operation by timeout
     * @param abortController (Optional) If provided, allows cancelling the operation by signal
     */
    private async _getDevfile(url: string, stack: string, version?: string, abortTimeout?: number, abortController?: AbortController): Promise<string> {
        const requestUrl = `${url}/devfiles/${stack}/${version ? version : DEVFILE_VERSION_LATEST}`;
        const key = ExecutionContext.key(requestUrl);
        if (this.executionContext && this.executionContext.has(key)) {
            return this.executionContext.get(key);
        }
        const devfile = DevfileRegistry._get(`${url}/devfiles/${stack}/${version ? version : DEVFILE_VERSION_LATEST}`,
                abortTimeout, abortController);
        this.executionContext.set(key, devfile);
        return devfile;
   }

    /**
     * Returns a list of the devfile registries from ODO preferences.
     *
     * @returns a list of the devfile registries
     */
    public async getRegistries(registryUrl?: string): Promise<Registry[]> {
        // Return only registries registered for user (from ODO preferences)
        // and filter by registryUrl (if provided)

        let registries: Registry[] = [];
        const key = ExecutionContext.key('getRegistries');
        if (this.executionContext && !this.executionContext.has(key)) {
            registries = await OdoPreference.Instance.getRegistries();
            this.executionContext.set(key, registries);
        } else {
            registries = this.executionContext.get(key);
        }

        return !registries ? [] :
            registries.filter((reg) => {
                if (registryUrl) {
                    return (reg.url === registryUrl)
                }
                return true;
            });
    }

    /**
     * Returns a list of the devfile infos for the specified registry or all the
     * registries, if not specified.
     *
     * @returns a list of the devfile infos
     */
    public async getRegistryDevfileInfos(registryUrl?: string): Promise<DevfileInfo[]> {
        const registries: Registry[] = await this.getRegistries(registryUrl);
        if (!registries || registries.length === 0) {
            // TODO: should throw 'new Error('No Devfile registries available. Default registry is missing');'
            // here so we can report this to users when a webview is open
            return [];
        }

        const devfiles: DevfileInfo[] = [];
        await Promise.all(registries
                .map(async (registry): Promise<void> => {
                    const devfileInfoList = (await this.getDevfileInfoList(registry.url))
                        .filter((devfileInfo) => 'stack' === devfileInfo.type.toLowerCase());
                    devfileInfoList.forEach((devfileInfo) => {
                            devfileInfo.registry = registry;
                        });
                    devfiles.push(...devfileInfoList);
                }));

        return devfiles.sort((a, b) => (a.name < b.name ? -1 : 1));
    }

    /**
     * Returns a devfile data with the raw devfile text attached
     *
     * @returns a devfile data with raw devfile text attached
     */
    public async getRegistryDevfile(registryUrl: string, name: string, version?: string):  Promise<DevfileData> {
        const rawDevfile = await this._getDevfile(registryUrl, name, version ? version : 'latest');
        const devfile = YAML.load(rawDevfile) as DevfileData;
        devfile.yaml = rawDevfile;
        return devfile;
    }

    private static async _get(url: string, abortTimeout?: number, abortController?: AbortController): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const signal = abortController?.signal;
            const timeout = abortTimeout ? abortTimeout : 5000;
            const options = { rejectUnauthorized: false, signal, timeout };
            let result: string = '';
            https.get(url, options, (response) => {
                if (response.statusCode < 500) {
                    response.on('data', (d) => {
                        result = result.concat(d);
                    });
                    response.resume();
                    response.on('end', () => {
                        if (!response.complete) {
                            reject(new Error(`The connection was terminated while the message was still being sent: ${response.statusMessage}`));
                        } else {
                            resolve(result);
                        }
                    });
                } else {
                    reject(new Error(`Connect error: ${response.statusMessage}`));
                }
            }).on('error', (e) => {
                reject(new Error(`Connect error: ${e}`));
            }).on('success', (s) => {
                resolve(result);
            });
        });
    }

    /**
     * Clears the Execution context as well as all cached data
     */
    public clearCache() {
        if (this.executionContext) {
            this.executionContext.clear();
        }
        this.executionContext = new ExecutionContext();
    }

}