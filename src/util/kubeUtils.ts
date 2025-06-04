/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubeConfig, loadYaml } from '@kubernetes/client-node/dist';
import { ActionOnInvalid, Cluster, Context, User } from '@kubernetes/client-node/dist/config_types';
import * as fs from 'fs';
import * as path from 'path';
import { QuickPickItem, window } from 'vscode';
import { stringify } from 'yaml';
import { CommandText } from '../base/command';
import { CliChannel, ExecutionContext } from '../cli';
import { Platform } from './platform';
import { YAML_STRINGIFY_OPTIONS } from './utils';

function fileExists(file: string): boolean {
    try {
        fs.accessSync(file);
        return true;
    } catch {
        return false;
    }
}

type KubeConfigEntry = {
    path: string,
    config?: KubeConfig
};

class CustomKubeConfig extends KubeConfig {
    constructor(ctmContexts: Context[], ctmCurrentContext: string, ctmClusters: Cluster[], ctmUsers: User[]) {
        super();
        super.loadFromOptions({
            contexts: ctmContexts,
            currentContext: ctmCurrentContext,
            clusters: ctmClusters,
            users: ctmUsers,
        });
    }
};

export class KubeConfigInfo {
    private configs: KubeConfigEntry[];
    private effectiveConfig: KubeConfig;

    constructor() {
        this.loadConfigs();
    }

    findHomeDir(): string {
        return Platform.getUserHomePath();
    }

    private loadConfigs(): void {
        const files: string[] = [];
        if (process.env.KUBECONFIG) {
            // Convert 'KUBECONFIG' value into a string array
            files.push(...process.env.KUBECONFIG.split(path.delimiter));
        }
        if (files.length === 0) {
            // Use default Kube config in case of 'KUBECONFIG' isn't defiled or empty
            files.push(path.join(this.findHomeDir(), '.kube', 'config'));
        }

        const entries: KubeConfigEntry[] = [];
        for (let i = 0; i < files.length; i++) {
            if (fs.existsSync(files[i]) && !entries.find((e: KubeConfigEntry) => e.path === files[i])) {
                entries.push( {path: files[i], config: loadKubeConfig(files[i])});
            }
        }
        this.configs = entries;
    }

    public getEffectiveKubeConfig(): KubeConfig {
        if (!this.effectiveConfig) {
            if (this.configs.length > 0) {
                this.effectiveConfig = this.merge(this.configs);
            } else {
                // Added for compatibility with '@kubernetes/client-node', which returns a 'default' Kube config
                // when it can't read the default configuration file
                const defaultConfig = new KubeConfig();
                defaultConfig.loadFromDefault();
                this.effectiveConfig = defaultConfig;
            }
        }
        return this.effectiveConfig;
    }

    /**
     * Returns the map of Kube config path to Context objects compouund the same way as
     * the effective Kube config is built (first Kube config file wins for an appearing context)
     *
     * @returns Map of Kube config path to context objects
     */
    public getContextMap(): Map<string, Context[]> {
        const contextMap: Map<string, Context[]> = new Map();
        for (const ctx of this.getEffectiveKubeConfig().contexts) {
            // Find the first Kube config file containing this context
            for (const cfg of this.configs) {
                if (cfg.config?.contexts?.find((c) => c.name === ctx.name)) {
                    const newPathContexts = contextMap.has(cfg.path) ? contextMap.get(cfg.path) : [];
                    newPathContexts.push(ctx);
                    contextMap.set(cfg.path, newPathContexts);
                    break; // Stop searching through the rest of configs
                }
            }
        }
        return contextMap;
    }

    /**
     * @returns Map of Kube config path to cluster objects
     */
    public getClusterMap(): Map<string, Cluster[]> {
        const clusterMap: Map<string, Cluster[]> = new Map();
        for (const cluster of this.getEffectiveKubeConfig().clusters) {
            // Find the first Kube config file containing this cluster
            for (const cfg of this.configs) {
                if (cfg.config?.clusters?.find((c) => c.name === cluster.name)) {
                    const newPathClusters = clusterMap.has(cfg.path) ? clusterMap.get(cfg.path) : [];
                    newPathClusters.push(cluster);
                    clusterMap.set(cfg.path, newPathClusters);
                    break; // Stop searching through the rest of configs
                }
            }
        }
        return clusterMap;
    }

    /**
     * @returns Map of Kube config path to user objects
     */
    public getUserMap(): Map<string, User[]> {
        const userMap: Map<string, User[]> = new Map();
        for (const user of this.getEffectiveKubeConfig().users) {
            // Find the first Kube config file containing this user
            for (const cfg of this.configs) {
                if (cfg.config?.users?.find((u) => u.name === user.name)) {
                    const newPathUsers = userMap.has(cfg.path) ? userMap.get(cfg.path) : [];
                    newPathUsers.push(user);
                    userMap.set(cfg.path, newPathUsers);
                    break; // Stop searching through the rest of configs
                }
            }
        }
        return userMap;
    }

    public findContext(contextName: string): Context {
        return this.getEffectiveKubeConfig()?.contexts?.find((context: Context) => context.name === contextName);
    }

    public findCluster(clusterServer: string): Cluster {
        return this.getEffectiveKubeConfig()?.clusters?.find((cluster: Cluster) => cluster.server === clusterServer);
    }

    public findClusterURL(clusterNameOrURL: string): string {
        let clusterObj: Cluster = this.findCluster(clusterNameOrURL);
        clusterObj = clusterObj || this.getEffectiveKubeConfig()?.clusters?.find((cluster: Cluster) => cluster.name === clusterNameOrURL);
        return clusterObj ? clusterObj.server : undefined;
    }

    public findContextForCluster(clusterName: string): Context {
        return this.getEffectiveKubeConfig()?.contexts?.find((context: Context) => context.cluster === clusterName);
    }

    public getClusterUsers(clusterServer: string): QuickPickItem[] {
        const currentUser = this.getEffectiveKubeConfig().getCurrentUser();
        const cluster = this.findCluster(clusterServer);
        const clusterUsers = this.getEffectiveKubeConfig().users?.filter((item) => cluster && item.name.includes(cluster.name));
        return clusterUsers.map((u: User) => {
            const userName = u.name.split('/')[0];
            return {
                label: userName === 'kube:admin' ? 'kubeadmin' : userName,
                description: u === currentUser ? 'Current Context' : '',
            };
        });
    }

    getProxy(contextName: string): string | undefined {
        if (process.env.KUBECONFIG?.[1]) {
            const cFiles = process.env.KUBECONFIG.split(path.delimiter).filter(file => file);
            for (let i=0; i < cFiles.length; i++) {
                const proxyUrl = this.getClusterProxyFromFile(cFiles[i], contextName);
                if (proxyUrl) return proxyUrl;
            }
            return;
        }
        const home = new KubeConfigInfo().findHomeDir();
        if (home) {
            const config = path.join(home, '.kube', 'config');
            if (fileExists(config)) {
                return this.getClusterProxyFromFile(config, contextName);
            }
        }
    }

    getClusterProxyFromFile(file: string, contextName: string): string {
        const fileContent = fs.readFileSync(file, 'utf8');
        const yaml: any = loadYaml(fileContent);
        const contextObj = yaml.contexts?.find(
            (context) => context.name === contextName);
        const clusterObj = yaml.clusters?.find(
            (cluster) => cluster.name === contextObj?.context?.cluster);
        return clusterObj?.cluster?.['proxy-url'];
    }

    public equalsToCurrentContext(contextName:string, cluster: string, namespace: string, user: string): boolean {
        const currentContext = this.findContext(this.getEffectiveKubeConfig().currentContext);
        if (!currentContext) return false;
        if (currentContext.name !== contextName) return false;
        if (currentContext.cluster !== cluster) return false;
        if (currentContext.namespace !== namespace) return false;
        if (currentContext.user !== user) return false;
        return true;
    }

    public extractProjectNameFromCurrentContext():string {
        const currentContextName = this.getEffectiveKubeConfig().currentContext;
        return extractProjectNameFromContextName(currentContextName);
    }

    private merge(configs: KubeConfigEntry[]): KubeConfig {
        const mergedContexts = this.mergeContexts(configs);
        const mergedClusters = this.mergeClusters(configs);
        const mergedUsers = this.mergeUsers(configs);
        const contextPreferences = this.contextPreference(configs);
        let mergedCurrentContext = undefined;
        for (let i = 0; i < contextPreferences.length; i++) {
            if (mergedContexts.find((c) => c.name === contextPreferences[i])) {
                mergedCurrentContext = contextPreferences[i];
                break;
            }
        }
        if (!mergedCurrentContext) {
            window.showWarningMessage('Kube cinfiguration doesn\'t define any current context value.');
        }
        return new CustomKubeConfig(mergedContexts, mergedCurrentContext, mergedClusters, mergedUsers);
    }

    private mergeClusters(configs: KubeConfigEntry[]): Cluster[] {
        const mergedClusters: Cluster[] = [];

        // process Kube configs in inverse order, so that the first Kube config has precedence
        for (let i = configs.length - 1; i >= 0; i--) {
            if (configs[i].config?.clusters) {
                for (const cluster of configs[i].config.clusters) {
                    if (cluster) {
                        const index = mergedClusters.findIndex((c) => c.name === cluster.name);
                        if (index >= 0) {
                            mergedClusters[index] = cluster;
                        } else {
                            mergedClusters.push(cluster);
                        }
                    }
                }
            }
        }
        return mergedClusters;
    }

    private mergeContexts(configs: KubeConfigEntry[]): Context[] {
        const mergedContexts: Context[] = [];

        // process Kube configs in inverse order, so that the first Kube config has precedence
        for (let i = configs.length - 1; i >= 0; i--) {
            if (configs[i].config?.contexts) {
                for (const ctx of configs[i].config.contexts) {
                    if (ctx) {
                        const index = mergedContexts.findIndex((c) => c.name === ctx.name);
                        if (index >= 0) {
                            mergedContexts[index] = ctx;
                        } else {
                            mergedContexts.push(ctx);
                        }
                    }
                }
            }
        }
        return mergedContexts;
    }

    private mergeUsers(configs: KubeConfigEntry[]): User[] {
        const mergedUsers: User[] = [];

        // process Kube configs in inverse order, so that the first Kube config has precedence
        for (let i = configs.length - 1; i >= 0; i--) {
            if (configs[i].config?.users) {
                for (const usr of configs[i].config.users) {
                    if (usr) {
                        const index = mergedUsers.findIndex((c) => c.name === usr.name);
                        if (index >= 0) {
                            mergedUsers[index] = usr;
                        } else {
                            mergedUsers.push(usr);
                        }
                    }
                }
            }
        }
        return mergedUsers;
    }

    /**
     * Returns the array of 'current-context''s constructed from the merged Kube configs.
     * The first array element will be the most prefered context as it's been constructed from the first
     * Kube config appeared during the merge.
     */
    private contextPreference(configs: KubeConfigEntry[]): string[] {
        const mergedCurrentContexts: string[] = [];
        for (let i = 0; i < configs.length; i++) {
            if (configs[i].config?.currentContext && configs[i].config.currentContext.trim().length > 0) {
                if (!mergedCurrentContexts.find((cc) => cc === configs[i].config.currentContext)) {
                    mergedCurrentContexts.push(configs[i].config.currentContext);
                }
            }
        }
        return mergedCurrentContexts;
    }

    /**
     * Finds the Kube Config path for the specified context name
     *
     * @param context Context name to search Kube config path for, if not specified the current context will be used
     * to search Kube config path
     *
     * @returns `string` value of the Kube Config file where the current context is defined or `undefined`
     */
    public static getContextConfigPath(context: string): string | undefined {
        const latestConfigInfo = new KubeConfigInfo();
        const contextEntries = [...latestConfigInfo.getContextMap()];
        const [configPath] = contextEntries.find(([key, value]) => value.find((c) => c.name === context));
        return configPath;
    }

    /**
     * Finds the Kube Config path for the current context
     *
     * @returns `string` value of the Kube Config file where the current context is defined or `undefined`
     */
    public static getCurrentContextConfigPath(): string | undefined {
        const latestConfigInfo = new KubeConfigInfo();
        const currentContext = latestConfigInfo.getEffectiveKubeConfig().currentContext;
        return this.getContextConfigPath(currentContext);
    }

    /**
     * Finds the Kube Config path for the main (first or a default one) context
     *
     * @returns `string` value of the Kube Config file where the current context is defined or `undefined`
     */
    public static getMainContextConfigPath(): string | undefined {
        return new KubeConfigInfo().configs[0].path;
    }

    /**
     * Returns the list of all the Kube Config paths declared in '$KUBECONFIG' env. variable or the default one
     *
     * @returns An array of the Kube Config file paths or `undefined`
     */
    public static getAllConfigPaths(): string[] {
        return new KubeConfigInfo().configs.map((c) => c.path);
    }

    public dumpEffectiveKubeConfig(): string {
        return stringify(this.sanitizeKubeConfig(this.getEffectiveKubeConfig()), YAML_STRINGIFY_OPTIONS);
    }

    private sanitizeKubeConfig(config: KubeConfig): any {
        const sanitizedConfig = JSON.parse(config.exportConfig()); // Deep copy to avoid mutating original

        // Function to recursively sanitize values
        function sanitize(obj: any) {
            for (const key in obj) {
                if (obj[key] && typeof obj[key] === 'object') {
                    sanitize(obj[key]);
                } else if (typeof obj[key] === 'string' && key.includes('token')) {
                    obj[key] = '[REDACTED]'; // Replace token-like strings with [REDACTED]
                } else if (typeof obj[key] === 'string' && key.includes('data')) {
                    obj[key] = '[DATA+OMITTED]'; // Replace token-like strings with [DATA+OMITTED]
                }
            }
        }

        sanitize(sanitizedConfig);
        return sanitizedConfig;
    }
}

/**
 * Returns the list of kube config files:
 * - If KUBECONFIG is not set, just ~/.kube/config
 * - If KUBECONFIG is set, follows the semantics for specifying multiple config files described here:
 *   https://kubernetes.io/docs/tasks/access-application-cluster/configure-access-multiple-clusters/#append-home-kube-config-to-your-kubeconfig-environment-variable
 *   BUT: it shows an error if multiple configs are specified, since the Kubernetes client we are using doesn't support this use case.
 *
 * @returns the list of kube config files
 */
export function getKubeConfigFiles(): string[] {
    if (process.env.KUBECONFIG) {
        const configuredFiles: string[] = process.env.KUBECONFIG.split(path.delimiter);
        const filesThatExist: string[] = [];
        for (const configFile of configuredFiles) {
            if (fs.existsSync(configFile) && !filesThatExist.includes(configFile)) {
                filesThatExist.push(configFile);
            }
        }
        return filesThatExist;
    }

    const defaultKubeConfigFile = path.join(Platform.getUserHomePath(), '.kube', 'config');
    if (!fs.existsSync(defaultKubeConfigFile)) {
        void window.showErrorMessage(`Default Kubernetes configuration file doesn't exist at '${defaultKubeConfigFile}'`);
    }

    return [defaultKubeConfigFile];
}

export async function isOpenShiftCluster(executionContext?: ExecutionContext): Promise<boolean> {
    try {
        const stdout = await CliChannel.getInstance().executeSyncTool(new CommandText('oc', 'api-versions'), { timeout: 5000 }, executionContext);
        return stdout.includes('apps.openshift.io/v1');
    } catch {
        return false;
    }
  }

export async function getNamespaceKind(executionContext?: ExecutionContext): Promise<string> {
    if (executionContext && executionContext.has(getNamespaceKind.name)) {
        return executionContext.get(getNamespaceKind.name);
    }
    const result: string = (await isOpenShiftCluster(executionContext)) ? 'Project' : 'Namespace';
    if (executionContext) {
        executionContext.set(getNamespaceKind.name, result);
    }
    return result;
}

export function extractProjectNameFromContextName(contextName: string):string {
    if (contextName && contextName.includes('/') && !contextName.startsWith('/')) {
        return contextName.split('/')[0];
    }
    return undefined;
}

export function toKubeContext(context: Context) {
    return {
        name: context.name,
        context: {
            cluster: context.cluster,
            user: context.user,
            ...(context.namespace ? { namespace: context.namespace } : {})
        }
    };
}

export function toKubeCluster(cluster: Cluster) {
    const { name, caFile, caData, skipTLSVerify, tlsServerName, ...rest } = cluster;
    return {
        name,
        cluster: {
            ...rest,
            ...(caFile ? { 'certificate-authority': caFile } : {}),
            ...(caData ? { 'certificate-authority-data': caData } : {}),
            ...(skipTLSVerify !== undefined ? { 'insecure-skip-tls-verify': skipTLSVerify } : {}),
            ...(tlsServerName ? { 'tls-server-name': tlsServerName } : {})
          }
    };
}

export function toKubeUser(user: User) {
    const { name, certFile, certData, keyFile, keyData, ...rest } = user;
    return {
        name,
        user: {
            ...rest,
            ...(certFile ? { 'client-certificate': certFile } : {}),
            ...(certData ? { 'client-certificate-data': certData } : {}),
            ...(keyFile ? { 'client-key': keyFile } : {}),
            ...(keyData ? { 'client-key-data': keyData } : {}),
          }
    };
}

export function serializeKubeConfig(kc: KubeConfig): string {
    const fullConfig = {
        apiVersion: 'v1',
        clusters: kc?.clusters?.map(toKubeCluster),
        contexts: kc?.contexts?.map(toKubeContext),
        'current-context': kc?.getCurrentContext(),
        kind: 'Config',
        preferences: (kc as any)?.preferences ?? {},
        users: kc?.users?.map(toKubeUser),
    };

    return stringify(fullConfig, YAML_STRINGIFY_OPTIONS);
}

const _kubeConfigErrorCache: Map<string, any> = new Map<string, any>(); // Cache for KC loading errors, allows to skip duplicate reporting
export function loadKubeConfig(path: string): KubeConfig {
    const kc = new KubeConfig();
    try {
        kc.loadFromFile(path, { onInvalidEntry: ActionOnInvalid.FILTER });
        _kubeConfigErrorCache.delete(path);
    } catch (__err) {
        const cachedError = _kubeConfigErrorCache.get(path);
        if (cachedError) {
            if (!cachedError || cachedError !== __err) {
                _kubeConfigErrorCache.set(path, __err);
                window.showErrorMessage(`An error occured while loding KubeConfig from "${path}": ${__err}`);
            }
        }
    }
    return kc;
}