/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { get as httpGet } from 'http';
import { get as httpsGet } from 'https';
import * as YAML from 'js-yaml';
import { Registry } from '../odo/componentType';
import { OdoPreference } from '../odo/odoPreference';
import { ExecutionContext } from '../util/utils';
import { DevfileData, DevfileInfo } from './devfileInfo';

// Extension ID is used for cache directory naming
// Using a constant allows easy updates if extension name changes
const EXTENSION_CACHE_DIR = 'vs-openshift-tools';

/**
 * Get the base directory for devfile registry cache.
 * Can be overridden via VSCODE_OPENSHIFT_CACHE_ROOT environment variable.
 * Default: ~/.local/state/vs-openshift-tools/devfile-registry-cache
 *
 * Returns null if cache directory cannot be created or accessed.
 */
async function getDevfileCacheBaseDir(): Promise<string | null> {
    const os = require('os');
    const path = require('path');

    // Get cache root - can be overridden via environment variable
    // This allows the same env var to be used by tools.ts and other cache consumers
    const cacheRoot = process.env.VSCODE_OPENSHIFT_CACHE_ROOT ||
        path.join(os.homedir(), '.local', 'state');

    const cacheDir = path.join(
        cacheRoot,
        EXTENSION_CACHE_DIR,
        'devfile-registry-cache'
    );

    // Validate cache directory
    try {
        const fs = await import('fs/promises');

        // Try to create the directory if it doesn't exist
        await fs.mkdir(cacheDir, { recursive: true });

        // Check if it's actually a directory
        const stats = await fs.stat(cacheDir);
        if (!stats.isDirectory()) {
            // Path exists but is a file, not a directory - try fallback
            const fallback = path.join(os.tmpdir(), EXTENSION_CACHE_DIR, 'devfile-registry-cache');
            await fs.mkdir(fallback, { recursive: true });
            return fallback;
        }

        // Test write permissions by creating a temporary test file
        const testFile = path.join(cacheDir, '.write-test');
        await fs.writeFile(testFile, '', 'utf-8');
        await fs.unlink(testFile);

        return cacheDir;
    } catch (error) {
        // Try fallback to temp directory
        try {
            const fallback = path.join(os.tmpdir(), EXTENSION_CACHE_DIR, 'devfile-registry-cache');
            const fs = await import('fs/promises');
            await fs.mkdir(fallback, { recursive: true });
            return fallback;
        } catch {
            // No cache available - return null
            return null;
        }
    }
}

export const DEVFILE_VERSION_LATEST: string = 'latest';

/**
 * Wraps some the Devfile Registry REST API calls.
 */
export class DevfileRegistry {
    private static instance: DevfileRegistry;

    private executionContext: ExecutionContext = new ExecutionContext();
    private cacheWarningShown: boolean = false;

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
     * Download extra stack files (Dockerfile, Kubernetes manifests, etc.) referenced in the devfile.
     * These files are stored in the devfile registry GitHub repository alongside the devfile.
     *
     * Files are cached in the filesystem to avoid repeated downloads.
     *
     * @param registryUrl Devfile Registry URL
     * @param stackName Stack name (e.g., 'go', 'nodejs')
     * @param version Stack version (e.g., '2.6.0')
     * @param resolvedDevfile The resolved devfile (with parents merged)
     * @param projectPath The project path where files should be written
     * @returns Promise that resolves when all files are downloaded and written
     * @throws Error if any file download or write fails
     */
    public async downloadStackExtraFiles(
        registryUrl: string,
        stackName: string,
        version: string,
        resolvedDevfile: any,
        projectPath: string
    ): Promise<void> {
        const uriPaths = this.extractUriPaths(resolvedDevfile);

        if (uriPaths.length === 0) {
            return;
        }

        // Download and write each file, collecting any errors
        const results = await Promise.allSettled(
            uriPaths.map(async (uriPath) => {
                const content = await this.getStackFile(registryUrl, stackName, version, uriPath);
                if (!content) {
                    throw new Error(`Failed to download ${uriPath} from ${stackName}:${version}`);
                }
                await this.writeStackFile(projectPath, uriPath, content);
                return uriPath;
            })
        );

        // Check for failures and report them
        const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
        if (failures.length > 0) {
            const errorMessages = failures.map(f => f.reason?.message || String(f.reason)).join('; ');
            throw new Error(`Failed to download ${failures.length} file(s): ${errorMessages}`);
        }
    }

    /**
     * Extract all URI paths from devfile components (dockerfile.uri, kubernetes.uri, etc.)
     */
    private extractUriPaths(devfile: any): string[] {
        const uriPaths: string[] = [];

        if (!devfile.components) {
            return uriPaths;
        }

        for (const component of devfile.components) {
            // Check for dockerfile uri in image components
            if (component.image?.dockerfile?.uri) {
                uriPaths.push(component.image.dockerfile.uri);
            }

            // Check for kubernetes/openshift uri
            if (component.kubernetes?.uri) {
                uriPaths.push(component.kubernetes.uri);
            }

            if (component.openshift?.uri) {
                uriPaths.push(component.openshift.uri);
            }
        }

        return uriPaths;
    }

    /**
     * Get a stack file from cache or download from GitHub registry repository
     * @throws Error if download fails
     */
    private async getStackFile(
        registryUrl: string,
        stackName: string,
        version: string,
        uriPath: string
    ): Promise<string | null> {
        const cacheKey = ExecutionContext.key(`stack-file:${registryUrl}:${stackName}:${version}:${uriPath}`);

        // Check memory cache first
        if (this.executionContext && this.executionContext.has(cacheKey)) {
            return this.executionContext.get(cacheKey);
        }

        // Check filesystem cache
        const cachedContent = await this.getFromFileCache(stackName, version, uriPath);
        if (cachedContent) {
            this.executionContext.set(cacheKey, cachedContent);
            return cachedContent;
        }

        // Download from GitHub registry repository
        try {
            const content = await this.downloadFromRegistryRepo(stackName, version, uriPath);

            // Cache in memory and filesystem
            this.executionContext.set(cacheKey, content);
            await this.saveToFileCache(stackName, version, uriPath, content);

            return content;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to download ${uriPath}: ${errorMessage}`);
        }
    }

    /**
     * Download a file from the devfile registry GitHub repository
     */
    private async downloadFromRegistryRepo(
        stackName: string,
        version: string,
        uriPath: string
    ): Promise<string> {
        const url = `https://raw.githubusercontent.com/devfile/registry/main/stacks/${stackName}/${version}/${uriPath}`;
        return DevfileRegistry._get(url);
    }

    /**
     * Get cached file content from filesystem.
     * Cache location can be overridden via VSCODE_OPENSHIFT_CACHE_ROOT env var.
     * Default: ~/.local/state/vs-openshift-tools/devfile-registry-cache
     */
    private async getFromFileCache(
        stackName: string,
        version: string,
        uriPath: string
    ): Promise<string | null> {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');

            const cacheBaseDir = await getDevfileCacheBaseDir();
            if (!cacheBaseDir) {
                // Warn user once that caching is unavailable
                if (!this.cacheWarningShown) {
                    this.cacheWarningShown = true;
                    // eslint-disable-next-line no-console
                    console.warn('[vscode-openshift-tools] Devfile registry cache is unavailable. Files will be downloaded without caching. Set VSCODE_OPENSHIFT_CACHE_ROOT to a writable directory to enable caching.');
                }
                return null;
            }

            const cacheDir = path.join(cacheBaseDir, stackName, version);
            const filePath = path.join(cacheDir, uriPath);

            const content = await fs.readFile(filePath, 'utf-8');
            return content;
        } catch {
            return null;
        }
    }

    /**
     * Save file content to filesystem cache.
     * Cache location can be overridden via VSCODE_OPENSHIFT_CACHE_ROOT env var.
     * Default: ~/.local/state/vs-openshift-tools/devfile-registry-cache
     */
    private async saveToFileCache(
        stackName: string,
        version: string,
        uriPath: string,
        content: string
    ): Promise<void> {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');

            const cacheBaseDir = await getDevfileCacheBaseDir();
            if (!cacheBaseDir) {
                // No cache available - silently skip (warning already shown in getFromFileCache)
                return;
            }

            const cacheDir = path.join(cacheBaseDir, stackName, version);
            const filePath = path.join(cacheDir, uriPath);

            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, content, 'utf-8');
        } catch {
            // Ignore cache write errors - cache is optional
        }
    }

    /**
     * Write a stack file to the project directory
     */
    private async writeStackFile(
        projectPath: string,
        uriPath: string,
        content: string
    ): Promise<void> {
        const fs = await import('fs/promises');
        const path = await import('path');

        const fullPath = path.join(projectPath, uriPath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, 'utf-8');
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
