/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import path from 'path';
import { DevfileRegistry, RegistryResourceResolver } from '../devfile-registry/devfileRegistryWrapper';
import { Archive } from '../downloadUtil/archive';
import { DownloadUtil } from '../downloadUtil/download';
import type {
    Data
} from '../odo/componentTypeDescription';
import { OdoPreference } from '../odo/odoPreference';
import { OpenshiftLogger } from '../util/utils';
import { cloneRepository } from '../util/git';
import { DevfileResolver } from './devfileResolver';

export async function initComponent(options: ComponentInitOptions) {
    const ctx = await createInitContext(options);

    logInfo(ctx, 'Initializing a new component...');
    logInfo(ctx, `Project: ${ctx.projectPath}`);

    await bootstrapWorkspace(ctx);

    const acquired = await acquireDevfile(ctx);

    logInfo(ctx, `Devfile acquired (${ctx.devfileSource})`);

    const acquiredDevfile = acquired.devfile;

    // Always resolve devfile to merge parent chain (needed for all sources: registry, file, local)
    logInfo(ctx, 'Resolving devfile (merging parent chain)...');
    let workingDevfile = await resolveDevfile(acquiredDevfile, acquired.devfilePath, acquired.provenance);
    logInfo(ctx, 'Parent chain merged');

    logInfo(ctx, 'Processing starter project...');

    const starterResult = await materializeStarterProjects(workingDevfile, ctx);

    if (starterResult.starterDevfilePath) {
        logInfo(ctx, `Using starter devfile: ${starterResult.starterDevfilePath}`);

        const raw = await fs.readFile(starterResult.starterDevfilePath, 'utf8');

        const parsed = yaml.load(raw);

        assertDevfileObject(parsed);

        // Resolve the starter's devfile too (merge its parents)
        // Note: provenance is undefined for starter devfiles (they come from git, not registry)
        workingDevfile = await resolveDevfile(parsed, starterResult.starterDevfilePath, undefined);
        logInfo(ctx, 'Starter devfile resolved and overrides registry devfile');
    }

    // Download registry resource files based on FINAL working devfile
    // (after starter devfile override, if any)
    // Resource files (docker/Dockerfile, kubernetes/deploy.yaml) come from the registry,
    // NOT from the starter project git repo
    if (acquired.provenance) {
        logInfo(ctx, 'Downloading registry resource files...');
        await downloadRegistryResources(workingDevfile, acquired.provenance, ctx);
        logInfo(ctx, 'Registry resources downloaded');
    }

    logInfo(ctx, 'Validating devfile...');

    // Use working devfile as-is (already resolved above for registry, or from file/local)
    const resolvedDevfile = workingDevfile;

    // analysis-only copy
    const analysisDevfile = interpolateDevfileVariables(structuredClone(resolvedDevfile));
    validateDevfileStructure(analysisDevfile);

    logInfo(ctx, 'Devfile valid');
    logInfo(ctx, 'Analyzing component readiness...');

    const readiness = analyzeDevfileReadiness(analysisDevfile);

    // Log warnings about missing features (non-blocking)
    if (readiness.warnings.length > 0) {
        readiness.warnings.forEach(warning => {
            logInfo(ctx, `Warning: ${warning}`);
        });
    }

    logInfo(ctx, 'Readiness check complete');
    logInfo(ctx, 'Normalizing devfile...');

    // The following creates a structured copy of working devfile
    const normalizedDevfile = normalizeDevfile(workingDevfile, ctx);

    await writeWorkspace(normalizedDevfile, acquired, ctx);

    logInfo(ctx, `Devfile written to ${acquired.devfilePath}`);
    logInfo(ctx, `Project created in ${ctx.projectPath}`);

    await writeInitState(readiness, acquired, ctx, starterResult);

    logInfo(ctx, `Component '${ctx.name}' initialized`);
    logInfo(ctx, 'Component ready');

    return buildInitResult(normalizedDevfile, acquired, ctx);
}

type Devfile = Data;

type DevfileSource = 'local' | 'file' | 'registry';

type InitContext = {
    projectPath: string;

    devfileSource: DevfileSource;
    workspaceInitiallyEmpty: boolean;
    isHybridInit: boolean;

    sourceDevfilePath?: string;

    registryDevfile?: string;
    registryDevfileVersion?: string;

    name: string;
    options: ComponentInitOptions;
};

function logInfo(ctx: InitContext, message: string) {
    try {
        ctx.options.logger?.info(message);
    } catch (err) {
        /* eslint-disable-next-line no-console */
        console.error('[initComponent logger info failed]', err);
    }
}

function logError(ctx: InitContext, message: string) {
    try {
        ctx.options.logger?.error(message);
    } catch (err) {
        /* eslint-disable-next-line no-console */
        console.error('[initComponent logger error failed]', err);
    }
}

async function createInitContext(options: ComponentInitOptions): Promise<InitContext> {
    const projectPath = path.resolve(options.projectPath ?? process.cwd());
    const devfileSource = detectSource(options);
    const sourceDevfilePath = options.devfilePath ? path.resolve(options.devfilePath) : undefined;

    const workspaceInitiallyEmpty = await isWorkspaceEffectivelyEmpty(projectPath);
    const isHybridInit = devfileSource !== 'local' && !workspaceInitiallyEmpty;

    return {
        projectPath,
        devfileSource,
        workspaceInitiallyEmpty,
        isHybridInit,
        sourceDevfilePath,
        registryDevfile: options.registryDevfile,
        registryDevfileVersion: options.devfileVersion,

        name: options.name ?? path.basename(projectPath),
        options
    };
}

function detectSource(options: ComponentInitOptions): InitContext['devfileSource'] {
    if (options.devfilePath) {
        return 'file';
    }

    if (options.registryDevfile) {
        return 'registry';
    }

    return 'local';
}

export interface ComponentInitOptions {
    name?: string;
    registryDevfile?: string;
    devfileVersion?: string;
    devfilePath?: string;
    registry?: string;          // optional registry override
    starterProject?: string;
    projectPath?: string;
    runPort?: number;
    language?: string;
    force?: boolean;
    gitInit?: boolean;
    logger?: OpenshiftLogger;
}

async function bootstrapWorkspace(ctx: InitContext) {
    await fs.mkdir(
        ctx.projectPath,
        { recursive: true }
    );
}

async function fetchDevfileFromRegistry(devfileRef: string, registry?: string, devfileVersion?: string): Promise<AcquiredDevfile> {
    const registryClient = DevfileRegistry.Instance;
    const registryUrl = await OdoPreference.Instance.resolveRegistryUrl(registry);
    const index = await registryClient.getDevfileInfoList(registryUrl);

    const stack = index.find(s => s.name === devfileRef);
    if (!stack) {
        throw new Error(`Devfile "${devfileRef}" not found in registry`);
    }

    const versionEntry =
        stack.versions.find(
            v => v.version === devfileVersion
        )
        ?? stack.versions.find(v => v.default)
        ?? stack.versions[0];

    return {
        devfile:
            await registryClient.getRegistryDevfile(
                registryUrl,
                devfileRef,
                versionEntry.version
            ),

        provenance: {
            url: registryUrl,
            stack: devfileRef,
            version: versionEntry.version
        },
    };
}

type DevfileProvenance = {
    url: string;
    stack: string;
    version: string;
};

type AcquiredDevfile = {
    devfile: Devfile;
    devfilePath?: string;
    provenance?: DevfileProvenance;
};

async function acquireDevfile(ctx: InitContext): Promise<AcquiredDevfile> {
    const { options, projectPath } = ctx;

    // CASE 1 — local devfile in workspace
    if (ctx.devfileSource === 'local') {
        const resolvedPath = await DevfileResolver.resolveDevfilePath(projectPath);
        if (!resolvedPath) {
            throw new Error('No devfile found in project directory');
        }

        const raw = await fs.readFile(resolvedPath, 'utf-8');
        const parsed = yaml.load(raw);

        assertDevfileObject(parsed);

        return {
            devfile: parsed,
            devfilePath: resolvedPath
        };
    }

    // CASE 2 — explicit devfile path
    if (ctx.devfileSource === 'file') {
        const sourcePath = ctx.sourceDevfilePath!;
        const raw = await fs.readFile(sourcePath, 'utf-8');
        const parsed = sourcePath.endsWith('.json') ? JSON.parse(raw) : yaml.load(raw);

        assertDevfileObject(parsed);

        return {
            devfile: parsed,
            devfilePath:
                path.join(
                    projectPath,
                    'devfile.yaml'
                )
        };
    }

    // CASE 3 — registry devfile
    const outputPath = path.join(projectPath, 'devfile.yaml');

    logInfo(ctx, `Downloading devfile "${options.registryDevfile}:${options.devfileVersion ?? 'latest'}" from registry "${options.registry}"`);

    if (await exists(outputPath)) {
        throw new Error(`A Devfile already exists in ${projectPath} directory`);
    }

    try {
        const acquired = await fetchDevfileFromRegistry(options.registryDevfile!, options.registry, options.devfileVersion);

        // When fetched from defvile registry, the resultig devfile gets added with
        // `yaml` property containing an original devfile text.
        // This makes the real ODO to complain about it as "unknown property" found,
        // so we have to strip this extra property from the object.
        const rawDevfile = acquired?.devfile as any;
        if (rawDevfile?.yaml) {
            delete rawDevfile?.yaml;
        }

        logInfo(ctx, 'Devfile downloaded');

        assertDevfileObject(rawDevfile);

        return {
            devfile: rawDevfile,
            devfilePath: outputPath,
            provenance: acquired.provenance  // Include provenance for resource downloads
        };
    } catch (err: any) {
        logError(ctx, `Failed to download devfile "${options.registryDevfile}"`);
        logError(ctx, err?.stack ?? '<no stack>');
        throw err;
    }
}

async function resolveDevfile(
    devfile: Devfile,
    devfilePath: string | undefined,
    provenance?: DevfileProvenance
): Promise<Devfile> {
    const resolver = new DevfileResolver();

    // Build sourceUrl from provenance if available (registry devfiles)
    const sourceUrl = provenance
        ? `${provenance.url}/devfiles/${provenance.stack}/${provenance.version}`
        : undefined;

    return resolver.resolve(devfile, {
        devfilePath,
        sourceUrl,
    });
}

type DevfileReadiness = {
    runnable: boolean;
    deployable: boolean;
    debuggable: boolean;
    warnings: string[];
};

function analyzeDevfileReadiness(devfile: Devfile): DevfileReadiness {
    const warnings: string[] = [];

    const hasContainer = devfile.components?.some(
        c => c.container || c.image
    );

    if (!hasContainer) {
        warnings.push('No container/image component found - component may not be runnable in dev mode');
    }

    const runCmd = devfile.commands?.find(
        c => c.exec?.group?.kind === 'run'
    );

    if (!runCmd) {
        warnings.push('No run command (group: run) found - odo dev will not be available');
    }

    const debugCmd = devfile.commands?.find(
        c => c.exec?.group?.kind === 'debug'
    );

    if (!debugCmd) {
        warnings.push('No debug command (group: debug) found - odo debug will not be available');
    }

    const deployCmd = devfile.commands?.find(
        c => c.apply || c.exec?.group?.kind === 'deploy' || c.composite?.group?.kind === 'deploy'
    );

    if (!deployCmd) {
        warnings.push('No deploy command found - odo deploy may not be available');
    }

    return {
        runnable: !!runCmd && !!hasContainer,
        deployable: !!deployCmd,
        debuggable: !!debugCmd,
        warnings
    };
}

async function writeWorkspace(devfile: Devfile, acquired: AcquiredDevfile, ctx: InitContext) {
    if (!acquired.devfilePath) {
        throw new Error('Missing target devfile path');
    }

    const content = yaml.dump(devfile, { noRefs: true });

    const tmp = `${acquired.devfilePath}.tmp`;
    await fs.mkdir(path.dirname(acquired.devfilePath), { recursive: true });
    await fs.writeFile(tmp, content, 'utf-8');
    await fs.rename(tmp, acquired.devfilePath);

    const odoDir = path.join(ctx.projectPath, '.odo');
    await fs.mkdir(odoDir, { recursive: true });
}

type InitState = {
    version: number;

    name: string;

    source:
        | 'local'
        | 'registry'
        | 'file';

    devfilePath: string;

    initializedAt: string;

    registry?: DevfileProvenance;

    sourceUrl?: string;

    originalDevfile?: string;

    starterProject?: string;

    starter?: StarterMaterialization;


    readiness: {
        runnable: boolean;
        deployable: boolean;
        debuggable: boolean;
        warnings: string[];
    };
};

async function writeInitState(readiness: DevfileReadiness, acquired: AcquiredDevfile, ctx: InitContext, starter: StarterMaterialization) {
    // Build sourceUrl from provenance if available (registry devfiles)
    const sourceUrl = acquired.provenance
        ? `${acquired.provenance.url}/devfiles/${acquired.provenance.stack}/${acquired.provenance.version}`
        : undefined;

    const state: InitState = {
        version: 1,
        name: ctx.name,
        source: ctx.devfileSource,
        devfilePath: acquired.devfilePath,
        initializedAt: new Date().toISOString(),
        readiness,
        registry: acquired.provenance,
        sourceUrl,
        originalDevfile: ctx.sourceDevfilePath,
        starterProject: ctx.options.starterProject,
        starter
    };

    await fs.writeFile(
        path.join(ctx.projectPath, '.odo', 'initstate.json'),
        JSON.stringify(state, null, 2),
        'utf-8'
    );
}

function buildInitResult(devfile: Devfile, acquired: AcquiredDevfile, ctx: InitContext): ComponentInitResult {
    const created = ctx.workspaceInitiallyEmpty;

    return {
        projectPath: ctx.projectPath,
        devfilePath: acquired.devfilePath!,
        devfile,
        created
    };
}

export interface ComponentInitResult {
    projectPath: string;
    devfilePath: string;
    devfile: Devfile;
    created: boolean;
}

async function exists(file: string): Promise<boolean> {
    try {
        await fs.access(file);
        return true;
    } catch {
        return false;
    }
}

function isIgnorableWorkspaceFile(name: string): boolean {
    return [
        '.git',
        '.gitignore',
        '.odo',
        '.vscode',
        '.idea',
        'README.md'
    ].includes(name);
}

async function isWorkspaceEffectivelyEmpty(dir: string): Promise<boolean> {
    const files = await fs.readdir(dir);
    return files.every(isIgnorableWorkspaceFile);
}

type StarterMaterialization = {
    applied: boolean;
    type?: 'git' | 'zip';
    source?: string;
    branch?: string;
    selected?: string;
    starterDevfilePath?: string;
    skippedReason?: 'hybrid-init' | 'no-starters' | 'no-match';
};

async function findStarterDevfile(projectPath: string): Promise<string | undefined> {
    const candidates = [
        'devfile.yaml',
        'devfile.yml',
        'devfile.json'
    ];

    for (const file of candidates) {
        const full = path.join(projectPath, file);

        if (await exists(full)) {
            return full;
        }
    }

    return undefined;
}

async function materializeStarterProjects(devfile: Devfile, ctx: InitContext): Promise<StarterMaterialization> {
    const starters = devfile.starterProjects;

    if (!starters?.length) {
        return {
            applied: false,
            skippedReason: 'no-starters'
        };
    }

    const selected = starters.find(s => s.name === ctx.options.starterProject) ?? starters[0];
    if (!selected) {
        return {
            applied: false,
            skippedReason: 'no-match'
        };
    }

     if (ctx.isHybridInit) {
        return {
            applied: false,
            skippedReason: 'hybrid-init'
        };
    }

    const gitRemote = selected.git?.remotes?.origin;
    if (gitRemote) {
        const branch = selected.git?.checkoutFrom?.revision;

        logInfo(ctx, `Downloading starter project "${ctx.options.starterProject ?? selected?.name}"`);

        const result = await cloneRepository({
            url: gitRemote,
            location: ctx.projectPath,
            branch
        });

        if (!result.status) {
            throw new Error(`Failed to download starter project: ${result.error}`);
        }

        // Remove .git directory to disconnect from git history (matches odo behavior)
        const gitDir = path.join(ctx.projectPath, '.git');
        try {
            await fs.rm(gitDir, { recursive: true, force: true });
            logInfo(ctx, 'Removed .git directory');
        } catch (err) {
            // Non-fatal: continue if .git removal fails
            logInfo(ctx, `Warning: Could not remove .git: ${err.message}`);
        }

        logInfo(ctx, `Starter project "${selected.name}" downloaded`);

        const starterDevfilePath = await findStarterDevfile(ctx.projectPath);

        logInfo(ctx, 'Starter devfile detected');

        return {
            applied: true,
            type: 'git',
            source: gitRemote,
            branch,
            selected: selected.name,
            starterDevfilePath
        };
    }

    if (selected.zip?.location) {
        logInfo(ctx, `Downloading starter project "${ctx.options.starterProject ?? selected?.name}" (zip)`);

        await materializeZipStarter(selected.zip.location, ctx.projectPath);

        logInfo(ctx, `Starter project "${selected.name}" downloaded and extracted`);

        const starterDevfilePath = await findStarterDevfile(ctx.projectPath);

        logInfo(ctx, 'Starter devfile detected');

        return {
            applied: true,
            type: 'zip',
            source: selected.zip.location,
            selected: selected.name,
            starterDevfilePath
        };
    }

    return {
        applied: false,
        skippedReason: 'no-match'
    };
}

function normalizeDevfile(devfile: Devfile, ctx: InitContext): Devfile {
    const normalized: Devfile = structuredClone(devfile);

    applyMetadataName(normalized, ctx.name);

    applyRunPort(normalized, ctx.options.runPort);

    return normalized;
}

function applyMetadataName(devfile: Devfile, name: string) {
    devfile.metadata.name = name;
}

function applyRunPort(devfile: Devfile, runPort?: number) {
    if (!runPort) return;

    const components = devfile.components ?? [];

    const containerComponent = components.find(
        c => c.container
    );

    if (!containerComponent?.container) return;

    containerComponent.container.endpoints ??= [];

    const existingEndpoint = containerComponent.container.endpoints.find(
        e =>
            e.targetPort === runPort ||
            e.name === 'http'
    );

    if (existingEndpoint) {
        existingEndpoint.targetPort = runPort;
        existingEndpoint.exposure ??= 'public';
        existingEndpoint.protocol ??= 'http';

        return;
    }

    containerComponent.container.endpoints.push({
        name: 'http',
        targetPort: runPort,
        exposure: 'public',
        protocol: 'http'
    });
}

function validateDevfileStructure(devfile: Devfile) {
    if (!devfile) {
        throw new Error('Devfile is empty');
    }

    if (!devfile.schemaVersion) {
        throw new Error('Devfile is missing schemaVersion');
    }

    if (!devfile.metadata) {
        throw new Error('Devfile is missing metadata');
    }

    if (!devfile.metadata.name) {
        throw new Error('Devfile metadata.name is missing');
    }

    if (!Array.isArray(devfile.components)) {
        throw new Error('Devfile components must be an array');
    }

    if (!Array.isArray(devfile.commands)) {
        throw new Error('Devfile commands must be an array');
    }
}

function assertDevfileObject(devfile: unknown): asserts devfile is Devfile {
    if (!devfile || typeof devfile !== 'object' ||
        Array.isArray(devfile) ||
        !('schemaVersion' in devfile) || !('metadata' in devfile)
    ) {
        throw new Error('Invalid devfile format');
    }
}

function interpolateDevfileVariables(devfile: Devfile): Devfile {
    const vars = devfile.variables ?? {};

    function walk(value: unknown): unknown {
        if (typeof value === 'string') {
            return value.replace(
                /\{\{([A-Z0-9_]+)\}\}/g,
                (_, key) => vars[key] ?? `{{${key}}}`
            );
        }

        if (Array.isArray(value)) {
            return value.map(walk);
        }

        if (value && typeof value === 'object') {
            const result: any = {};

            for (const [k, v] of Object.entries(value)) {
                result[k] = walk(v);
            }

            return result;
        }

        return value;
    }

    return walk(devfile) as Devfile;
}

async function materializeZipStarter(url: string, projectPath: string) {
    const tmpZip = path.join(projectPath, '.devfile-starter.zip');

    try {
        await DownloadUtil.downloadFile(url, tmpZip);
        await Archive.validateZipPaths(tmpZip);
        await Archive.extractAll(tmpZip, projectPath);
    } finally {
        await fs.unlink(tmpZip).catch(() => undefined);
    }
}

/**
 * Downloads resource files referenced in the devfile from the registry repository.
 *
 * This downloads files like:
 * - docker/Dockerfile (from image.dockerfile.uri)
 * - kubernetes/deploy.yaml (from kubernetes.uri)
 * - Other resource files referenced in components
 *
 * Files are cached in ~/.odo/cache/{registryName}/ to avoid repeated downloads.
 *
 * @param devfile - The resolved devfile with URIs
 * @param provenance - Registry provenance (url, stack, version)
 * @param ctx - Init context
 */
async function downloadRegistryResources(
    devfile: Devfile,
    provenance: DevfileProvenance,
    ctx: InitContext
): Promise<void> {
    const resolver = new RegistryResourceResolver();
    const downloadedFiles: string[] = [];

    // Get registry name for caching
    const registryName = await getRegistryName(provenance.url);

    // Extract URIs from all components
    const uris = extractResourceUris(devfile);

    if (uris.length === 0) {
        logInfo(ctx, 'No resource URIs found in devfile');
        return;
    }

    logInfo(ctx, `Found ${uris.length} resource URI(s) to download`);

    for (const { uri } of uris) {
        try {
            logInfo(ctx, `Downloading ${uri}...`);

            // Download from registry (with caching)
            const content = await resolver.downloadResourceFile(
                uri,
                provenance.url,
                registryName,
                provenance.stack,
                provenance.version
            );

            if (content === null) {
                // 404 - file doesn't exist in registry
                logInfo(ctx, '  → Not found in registry (will need to be user-provided)');
                continue;
            }

            // Save to component folder
            const targetPath = path.join(ctx.projectPath, uri);
            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            await fs.writeFile(targetPath, content, 'utf-8');

            downloadedFiles.push(uri);
            logInfo(ctx, `  → Saved to ${uri}`);
        } catch (err) {
            logError(ctx, `  → Failed to download ${uri}: ${err.message}`);
            // Continue with other files - partial downloads are OK
        }
    }

    if (downloadedFiles.length > 0) {
        logInfo(ctx, `Downloaded ${downloadedFiles.length} resource file(s)`);
    }
}

/**
 * Extract resource URIs from devfile components.
 *
 * Looks for:
 * - kubernetes.uri
 * - openshift.uri
 * - image.dockerfile.uri
 */
function extractResourceUris(devfile: Devfile): Array<{ uri: string; componentType: string }> {
    const uris: Array<{ uri: string; componentType: string }> = [];

    if (!devfile.components) {
        return uris;
    }

    for (const component of devfile.components) {
        // Kubernetes component
        if (component.kubernetes?.uri) {
            uris.push({
                uri: component.kubernetes.uri,
                componentType: 'kubernetes'
            });
        }

        // OpenShift component
        if (component.openshift?.uri) {
            uris.push({
                uri: component.openshift.uri,
                componentType: 'openshift'
            });
        }

        // Dockerfile component
        if (component.image?.dockerfile?.uri) {
            uris.push({
                uri: component.image.dockerfile.uri,
                componentType: 'dockerfile'
            });
        }
    }

    return uris;
}

/**
 * Get the registry name from preferences for the given registry URL.
 * Falls back to sanitized URL if not found in preferences.
 */
async function getRegistryName(registryUrl: string): Promise<string> {
    try {
        const registries = await OdoPreference.Instance.getRegistries();
        const registry = registries.find(r => r.url === registryUrl);

        if (registry?.name) {
            return registry.name;
        }
    } catch {
        // Ignore preference errors
    }

    // Fallback: sanitize URL to use as folder name
    // https://registry.devfile.io → registry.devfile.io
    return registryUrl
        .replace(/^https?:\/\//, '')
        .replace(/[^a-zA-Z0-9.-]/g, '_');
}

