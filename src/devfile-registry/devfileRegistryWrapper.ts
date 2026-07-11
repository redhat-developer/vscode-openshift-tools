/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { get as httpGet } from 'http';
import { get as httpsGet } from 'https';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as YAML from 'js-yaml';
import { Registry } from '../odo/componentType';
import { OdoPreference } from '../odo/odoPreference';
import { ExecutionContext } from '../util/utils';
import { Platform } from '../util/platform';
import { DevfileData, DevfileInfo } from './devfileInfo';
import { DevfileUriResolver } from '../devfile/devfileUriResolver';

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
        const devfile = DevfileRegistry._get(
            `${url}/devfiles/${stack}/${version ? version : DEVFILE_VERSION_LATEST}`,
            abortTimeout,
            abortController);
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
            let request = httpGet;
            try {
                request = new URL(url).protocol.startsWith('https') ? httpsGet : httpGet;
            } catch (err) {
                // continue
            }
            const signal = abortController?.signal;
            const timeout = abortTimeout ? abortTimeout : 5000;
            const options = { signal, timeout };
            let result: string = '';
            request(url, options, (response) => {
                // Only accept 2xx status codes as success
                if (response.statusCode >= 200 && response.statusCode < 300) {
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
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                }
            }).on('error', (e) => {
                reject(new Error(`Connect error: ${e}`));
            }).on('success', (s) => {
                resolve(result);
            });
        });
    }

    /**
     * Downloads a resource file from a devfile registry (e.g., docker/Dockerfile, kubernetes/deploy.yaml).
     *
     * Uses caching in ~/.odo/cache/{registryName}/ to avoid repeated downloads.
     *
     * @param uri - Relative URI from devfile (e.g., "docker/Dockerfile")
     * @param registryUrl - Registry URL (e.g., "https://registry.devfile.io")
     * @param registryName - Registry name from preferences (for cache folder)
     * @param stack - Stack name (e.g., "go")
     * @param version - Stack version (e.g., "2.6.0")
     * @returns File content or null if not found (404)
     */
    public async downloadRegistryResource(
        uri: string,
        registryUrl: string,
        registryName: string,
        stack: string,
        version: string
    ): Promise<string | null> {
        const resolver = new RegistryResourceResolver();
        return resolver.downloadResourceFile(uri, registryUrl, registryName, stack, version);
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

/**
 * Resolves and downloads resource files (like docker/Dockerfile, kubernetes/deploy.yaml)
 * from devfile registries during component initialization.
 *
 * Resources are cached in ~/.odo/cache/{registryName}/{stack}/{version}/{uri}
 * to avoid repeated downloads and reduce 429 rate limit errors.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ EXTENSION POINT: To add support for other registry types                │
 * │ (OCI, S3, custom servers), add detection logic and URL builders         │
 * │ in getResourceUrl() method below.                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export class RegistryResourceResolver {

    /**
     * Downloads a resource file from a devfile registry with caching.
     *
     * This is the MAIN ENTRY POINT for registry resource downloads.
     *
     * Flow:
     * 1. Check cache in ~/.odo/cache/{registryName}/{stack}/{version}/{uri}
     * 2. If cached, return cached content
     * 3. If not cached, download from registry
     * 4. Save to cache
     * 5. Return content
     *
     * @param uri - Relative URI from devfile (e.g., "docker/Dockerfile")
     * @param registryUrl - Registry URL (e.g., "https://registry.devfile.io")
     * @param registryName - Registry name from preferences (for cache folder)
     * @param stack - Stack name (e.g., "go")
     * @param version - Stack version (e.g., "2.6.0")
     * @returns File content or null if not found (404)
     */
    public async downloadResourceFile(
        uri: string,
        registryUrl: string,
        registryName: string,
        stack: string,
        version: string
    ): Promise<string | null> {
        // 1. Try cache first
        const cachedContent = await this.getFromCache(registryName, stack, version, uri);
        if (cachedContent !== null) {
            return cachedContent;
        }

        // 2. Download from registry
        const resourceUrl = this.getResourceUrl(uri, registryUrl, stack, version);

        try {
            const content = await DevfileUriResolver.downloadContent(resourceUrl);

            // 3. Save to cache for future use
            await this.saveToCache(registryName, stack, version, uri, content);

            return content;
        } catch (err) {
            // 404 is OK - resource might be user-provided or not needed
            if (err.message?.includes('404') || err.message?.includes('Not Found')) {
                return null;
            }
            throw err;
        }
    }

    /**
     * Builds the download URL for a registry resource file.
     *
     * ┌─────────────────────────────────────────────────────────────────────┐
     * │ EXTENSION POINT: Add support for other registry types HERE         │
     * └─────────────────────────────────────────────────────────────────────┘
     *
     * Current implementation supports:
     * ✅ registry.devfile.io (GitHub-backed, main branch)
     * ✅ registry.stage.devfile.io (GitHub-backed, staging branch)
     *
     * To add support for NEW registry types:
     *
     * 1. Add a detection method (e.g., isOCIRegistry(), isS3Registry())
     * 2. Add a URL builder method (e.g., getOCIResourceUrl(), getS3ResourceUrl())
     * 3. Add the check in the if-else chain below
     *
     * Example registry types to support in the future:
     * - OCI registries: Use OCI artifact API
     * - S3-backed registries: Build S3 URLs
     * - Custom HTTP servers: Use registry-specific URL patterns
     * - Harbor registries: Use Harbor API
     * - Artifactory registries: Use Artifactory REST API
     */
    private getResourceUrl(
        uri: string,
        registryUrl: string,
        stack: string,
        version: string
    ): string {
        // ─────────────────────────────────────────────────────────
        // Registry type detection - ADD NEW TYPES HERE
        // ─────────────────────────────────────────────────────────

        // GitHub-backed registries (official and staging)
        if (this.isGitHubBackedRegistry(registryUrl)) {
            return this.getGitHubResourceUrl(uri, registryUrl, stack, version);
        }

        // ┌─────────────────────────────────────────────────────┐
        // │ FUTURE: Add other registry types here              │
        // └─────────────────────────────────────────────────────┘
        //
        // Example: OCI registry support
        // if (this.isOCIRegistry(registryUrl)) {
        //     return this.getOCIResourceUrl(uri, registryUrl, stack, version);
        // }
        //
        // Example: S3-backed registry
        // if (this.isS3Registry(registryUrl)) {
        //     return this.getS3ResourceUrl(uri, registryUrl, stack, version);
        // }
        //
        // Example: Harbor registry
        // if (this.isHarborRegistry(registryUrl)) {
        //     return this.getHarborResourceUrl(uri, registryUrl, stack, version);
        // }
        //
        // Example: Artifactory registry
        // if (this.isArtifactoryRegistry(registryUrl)) {
        //     return this.getArtifactoryResourceUrl(uri, registryUrl, stack, version);
        // }

        // Fallback: try GitHub pattern (most common)
        return this.getGitHubResourceUrl(uri, registryUrl, stack, version);
    }

    // ─────────────────────────────────────────────────────────────────────
    // GitHub-backed registry support (DEFAULT for devfile.io registries)
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Check if this registry is backed by the official GitHub devfile/registry repo.
     */
    private isGitHubBackedRegistry(registryUrl: string): boolean {
        return registryUrl.includes('registry.devfile.io') ||
               registryUrl.includes('registry.stage.devfile.io');
    }

    /**
     * Build GitHub raw URL for resource files.
     *
     * Pattern: https://raw.githubusercontent.com/devfile/registry/{branch}/stacks/{stack}/{version}/{uri}
     *
     * Examples:
     * - Production: https://raw.githubusercontent.com/devfile/registry/main/stacks/go/2.6.0/docker/Dockerfile
     * - Staging: https://raw.githubusercontent.com/devfile/registry/staging/stacks/go/2.6.0/docker/Dockerfile
     */
    private getGitHubResourceUrl(
        uri: string,
        registryUrl: string,
        stack: string,
        version: string
    ): string {
        // Staging registry uses 'staging' branch, production uses 'main'
        const branch = registryUrl.includes('stage') ? 'staging' : 'main';

        return `https://raw.githubusercontent.com/devfile/registry/${branch}/stacks/${stack}/${version}/${uri}`;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Cache management (uses ~/.odo/cache/)
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Get the cache directory for devfile registry resources.
     *
     * Location: ~/.odo/cache/{registryName}/{stack}/{version}/
     *
     * Example: ~/.odo/cache/DefaultDevfileRegistry/go/2.6.0/
     */
    private getCacheDir(registryName: string, stack: string, version: string): string {
        const homeDir = Platform.getUserHomePath();
        return path.join(homeDir, '.odo', 'cache', registryName, stack, version);
    }

    /**
     * Get cached resource file if it exists.
     *
     * @returns File content or null if not cached
     */
    private async getFromCache(
        registryName: string,
        stack: string,
        version: string,
        uri: string
    ): Promise<string | null> {
        try {
            const cacheDir = this.getCacheDir(registryName, stack, version);
            const cachedFile = path.join(cacheDir, uri);

            return await fs.readFile(cachedFile, 'utf-8');
        } catch (err) {
            // Cache miss - file doesn't exist
            return null;
        }
    }

    /**
     * Save resource file to cache.
     */
    private async saveToCache(
        registryName: string,
        stack: string,
        version: string,
        uri: string,
        content: string
    ): Promise<void> {
        try {
            const cacheDir = this.getCacheDir(registryName, stack, version);
            const cachedFile = path.join(cacheDir, uri);

            // Create cache directory structure
            await fs.mkdir(path.dirname(cachedFile), { recursive: true });

            // Write content to cache
            await fs.writeFile(cachedFile, content, 'utf-8');
        } catch (err) {
            // Cache write failure is non-fatal - just log and continue
            // This allows the function to work even if cache directory is read-only
            // Silently ignore cache errors to avoid cluttering output
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // FUTURE EXTENSION POINTS: Add new registry type handlers below
    // ─────────────────────────────────────────────────────────────────────

    // Example template for OCI registry support:
    //
    // /**
    //  * Detect if this is an OCI registry (GitHub Container Registry, Quay.io, etc.)
    //  */
    // private isOCIRegistry(registryUrl: string): boolean {
    //     return registryUrl.includes('ghcr.io') ||
    //            registryUrl.includes('quay.io') ||
    //            registryUrl.startsWith('oci://');
    // }
    //
    // /**
    //  * Build OCI artifact URL for resource files.
    //  *
    //  * Pattern: {registry}/{namespace}/{stack}:{version}/resources/{uri}
    //  */
    // private getOCIResourceUrl(
    //     uri: string,
    //     registryUrl: string,
    //     stack: string,
    //     version: string
    // ): string {
    //     // OCI registries typically expose resources via manifest layers
    //     // Implementation would require OCI client library
    //     const cleanRegistry = registryUrl.replace('oci://', '');
    //     return `${cleanRegistry}/${stack}:${version}/resources/${uri}`;
    // }

    // Example template for S3-backed registry:
    //
    // /**
    //  * Detect if this is an S3-backed registry
    //  */
    // private isS3Registry(registryUrl: string): boolean {
    //     return registryUrl.includes('s3.amazonaws.com') ||
    //            registryUrl.includes('.s3.') ||
    //            registryUrl.startsWith('s3://');
    // }
    //
    // /**
    //  * Build S3 URL for resource files.
    //  *
    //  * Pattern: https://{bucket}.s3.{region}.amazonaws.com/stacks/{stack}/{version}/{uri}
    //  */
    // private getS3ResourceUrl(
    //     uri: string,
    //     registryUrl: string,
    //     stack: string,
    //     version: string
    // ): string {
    //     // S3 URLs can be path-style or virtual-hosted-style
    //     const cleanUrl = registryUrl.replace('s3://', 'https://');
    //     return `${cleanUrl}/stacks/${stack}/${version}/${uri}`;
    // }

}
