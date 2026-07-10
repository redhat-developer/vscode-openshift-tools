/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import path from 'path';
import { DevfileInfo } from '../devfile-registry/devfileInfo';
import { DevfileRegistry } from '../devfile-registry/devfileRegistryWrapper';
import { OpenshiftLogger } from '../util/utils';
import { DevfileUriResolver } from './devfileUriResolver';

/**
 * Options for processing devfile resources during resolution
 */
export interface DevfileResolveOptions {
    /**
     * If true, inline resource URIs into the devfile (converting uri → inlined).
     * Used during `odo dev/deploy` to get a self-contained devfile.
     * Resources are loaded from disk (if devfilePath provided) or from URLs (if sourceUrl provided).
     */
    inlineResources?: boolean;

    /**
     * Absolute path to the source devfile on disk.
     * Required for resolving relative URIs to local files.
     */
    devfilePath?: string;

    /**
     * Source URL where the devfile was fetched from (for registry devfiles).
     * E.g., "https://registry.devfile.io/devfiles/go-basic/1.1.0"
     * Used to resolve relative URIs to registry resources.
     */
    sourceUrl?: string;

    /**
     * Optional logger for reporting resolution progress and errors.
     */
    logger?: OpenshiftLogger;
}

/**
 * Represents a devfile with its source URL for proper URI resolution
 */
interface DevfileWithSource {
    devfile: any;
    sourceUrl?: string;  // e.g., "https://registry.devfile.io/devfiles/go/2.6.0"
    devfilePath?: string;  // e.g., "/path/to/project/devfile.yaml" (for local devfiles)
}

export class DevfileResolver {

  private static parentCache = new Map<string, any>();

  static invalidateCache() {
    this.parentCache.clear();
  }

  /**
   * Resolves a devfile's parent chain and optionally processes resources.
   *
   * @param devfile - The devfile to resolve
   * @param options - Options for resource processing
   * @returns Resolved devfile (with parents merged and resources processed)
   */
  async resolve(devfile: any, options?: DevfileResolveOptions): Promise<any> {
    const chain = await this.resolveParentChain(devfile, options?.devfilePath, options?.sourceUrl);

    // First, merge the chain to get final component structure
    const mergedDevfile = this.mergeChain(chain.map(item => item.devfile));

    // Process resources AFTER merging, using source URL context from the chain
    // This ensures we only process components that survived the merge
    if (options?.inlineResources) {
      await this.processResourcesWithContext(mergedDevfile, chain, options);
    }

    return this.normalizeResolvedDevfile(mergedDevfile);
  }

  /**
   * Process resources for the merged devfile, finding the source context for each component.
   * Searches the chain backwards (child to parent) to find where each component originated.
   */
  private async processResourcesWithContext(
    mergedDevfile: any,
    chain: DevfileWithSource[],
    options: DevfileResolveOptions
  ): Promise<void> {
    if (!mergedDevfile.components) {
      return;
    }

    // Debug logging
    if (options.logger) {
      options.logger.info(`[DevfileResolver] Processing resources for ${mergedDevfile.components.length} components`);
      options.logger.info(`[DevfileResolver] Chain has ${chain.length} devfiles`);
      for (let i = 0; i < chain.length; i++) {
        options.logger.info(`[DevfileResolver] Chain[${i}]: sourceUrl=${chain[i].sourceUrl}, devfilePath=${chain[i].devfilePath}`);
      }
    }

    for (const component of mergedDevfile.components) {
      // Find which devfile in the chain this component came from
      // Search backwards (child to parent) - child components override parent
      const sourceItem = this.findComponentSource(component.name, chain);
      if (!sourceItem) {
        if (options.logger) {
          options.logger.warning(`[DevfileResolver] Component '${component.name}' not found in chain - skipping`);
        }
        continue;
      }

      if (options.logger) {
        options.logger.info(`[DevfileResolver] Component '${component.name}' from sourceUrl=${sourceItem.sourceUrl}`);
      }

      // Process resources for this component using its source context
      await this.processComponentResources(
        component,
        sourceItem,
        options
      );
    }
  }

  /**
   * Find the devfile in the chain that defined a component with the given name.
   * Searches from child to parent (backwards in chain).
   */
  private findComponentSource(componentName: string, chain: DevfileWithSource[]): DevfileWithSource | undefined {
    // Search backwards: last item (child) to first (root parent)
    for (let i = chain.length - 1; i >= 0; i--) {
      const item = chain[i];
      const hasComponent = item.devfile.components?.some((c: any) => c.name === componentName);
      if (hasComponent) {
        return item;
      }
    }
    return undefined;
  }

  /**
   * Process resources for a single component using its source context.
   */
  private async processComponentResources(
    component: any,
    sourceItem: DevfileWithSource,
    options: DevfileResolveOptions
  ): Promise<void> {
    const uriPaths = this.extractComponentUris(component);

    for (const { uriPath, componentType } of uriPaths) {
      try {
        // Resolve and download the URI using the source context
        const resolvedUri = DevfileUriResolver.resolveUri(
          uriPath,
          sourceItem.sourceUrl,
          sourceItem.devfilePath
        );

        const content = await DevfileUriResolver.downloadContent(resolvedUri);

        // Inline into devfile (only mode supported)
        this.inlineComponentResource(component, componentType, content);
      } catch (err) {
        // Log error but continue with other resources
        const errorMsg = `Failed to process resource ${uriPath}: ${err.message}`;
        if (options.logger?.warning) {
          options.logger.warning(errorMsg);
        }
        // If no logger provided, silently continue (tests, headless mode)
      }
    }
  }

  /**
   * Extract URIs from a single component
   */
  private extractComponentUris(component: any): Array<{ uriPath: string; componentType: string }> {
    const uris: Array<{ uriPath: string; componentType: string }> = [];

    // Check for kubernetes uri
    if (component.kubernetes?.uri) {
      uris.push({
        uriPath: component.kubernetes.uri,
        componentType: 'kubernetes'
      });
    }

    // Check for openshift uri
    if (component.openshift?.uri) {
      uris.push({
        uriPath: component.openshift.uri,
        componentType: 'openshift'
      });
    }

    // Check for dockerfile uri
    if (component.image?.dockerfile?.uri) {
      uris.push({
        uriPath: component.image.dockerfile.uri,
        componentType: 'dockerfile'
      });
    }

    return uris;
  }

  /**
   * Inline resource content into a component (converting uri → inlined)
   */
  private inlineComponentResource(
    component: any,
    componentType: string,
    content: string
  ): void {
    if (componentType === 'kubernetes') {
      component.kubernetes.inlined = content;
      delete component.kubernetes.uri;
    } else if (componentType === 'openshift') {
      component.openshift.inlined = content;
      delete component.openshift.uri;
    } else if (componentType === 'dockerfile') {
      component.image.dockerfile.inlined = content;
      delete component.image.dockerfile.uri;
    }
  }

  private normalizeResolvedDevfile(devfile: any): any {
    const result = { ...devfile };

    // Remove 'parent' reference (already merged into devfile)
    if (result?.parent) {
      delete result.parent;
    }

    // Remove 'yaml' property added by registry client (appears in parent chain too)
    if (result?.yaml) {
      delete result.yaml;
    }

    return result;
  }

  async loadDevfile(path: string): Promise<any> {
    const raw = await fs.readFile(path, 'utf-8');
    return path.endsWith('.json') ? JSON.parse(raw) : yaml.load(raw);
  }

  static async resolveDevfilePath(devfilePath: string): Promise<string | undefined> {
    try {
      const stats = await fs.stat(devfilePath);

      if (stats.isFile()) {
        return devfilePath;
      }

      if (stats.isDirectory()) {
        const candidates = ['devfile.yaml', 'devfile.yml', 'devfile.json'];

        for (const file of candidates) {
          const fullPath = path.join(devfilePath, file);
          try {
            await fs.access(fullPath);
            return fullPath;
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  /**
   * Resolve parent chain, tracking source URL for each devfile
   */
  private async resolveParentChain(devfile: any, devfilePath?: string, sourceUrl?: string): Promise<DevfileWithSource[]> {
    const chain: DevfileWithSource[] = [];
    const visited = new Set<string>();

    let current = devfile;

    while (current?.parent) {
      const key = this.getParentKey(current.parent);

      if (visited.has(key)) {
        throw new Error(` ✗  Circular parent reference detected: ${key}`);
      }
      visited.add(key);

      const { devfile: parent, sourceUrl: parentSourceUrl } = await this.fetchParentDevfile(current.parent);

      chain.unshift({ devfile: parent, sourceUrl: parentSourceUrl });
      current = parent;
    }

    // Add the original devfile
    // sourceUrl is explicitly provided for registry devfiles, undefined for local devfiles
    chain.push({
      devfile,
      sourceUrl,
      devfilePath
    });

    return chain;
  }

  private normalizeParent(parent: any) {
    return {
      registry: (parent.registryUrl || 'https://registry.devfile.io').replace(/\/$/, ''),
      id: parent.id,
      version: parent.version || 'latest',
    };
  }

  private getParentKey(parent: any): string {
    const p = this.normalizeParent(parent);
    return `${p.registry}|${p.id}|${p.version}`;
  }

  private normalizeVersion(v?: string): string | undefined {
    if (!v) return undefined;

    const parts = v.split('.');

    // normalize 2.2 → 2.2.0
    if (parts.length === 2) {
        return `${parts[0]}.${parts[1]}.0`;
    }

    return v;
  }

  private resolveVersionEntry(stack: DevfileInfo, requested?: string) {
      const normalizedRequested = this.normalizeVersion(requested);

      return (
          stack.versions.find(v =>
              this.normalizeVersion(v.version) === normalizedRequested
          )
          ?? stack.versions.find(v => v.version === requested)
          ?? stack.versions.find(v => v.default)
          ?? stack.versions[0]
      );
  }

  private async fetchFromRegistry(parent: any): Promise<{ devfile: any, sourceUrl: string }> {
      const p = this.normalizeParent(parent);

      const registry = DevfileRegistry.Instance;
      const index = await registry.getDevfileInfoList(p.registry);
      const stack = index.find((s: DevfileInfo) => s.name === p.id);
      if (!stack) {
          throw new Error(`Stack not found: ${p.id}`);
      }

      const versionEntry = this.resolveVersionEntry(stack, p.version);
      if (!versionEntry) {
          throw new Error(`Version not found: ${p.id}@${p.version}`);
      }

      const devfile = await registry.getRegistryDevfile(
          p.registry,
          p.id,
          versionEntry.version
      );

      // Build source URL for this devfile
      const sourceUrl = `${p.registry}/devfiles/${p.id}/${versionEntry.version}`;

      return { devfile, sourceUrl };
  }

  private async fetchParentDevfile(parent: any): Promise<{ devfile: any, sourceUrl: string }> {
    const key = this.getParentKey(parent);

    const cached = DevfileResolver.parentCache.get(key);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.fetchFromRegistry(parent);

      DevfileResolver.parentCache.set(key, result);

      return result;
    } catch (err: any) {
      throw new Error(` ✗  Failed to fetch parent devfile ${key}: ${err?.message || err}`);
    }
  }

  private mergeChain(chain: any[]): any {
    return chain.reduce((acc, curr) => this.mergeDevfiles(acc, curr));
  }

  private mergeDevfiles(parent: any, child: any): any {
    return {
      ...parent,
      ...child,
      metadata: this.deepMerge(parent.metadata, child.metadata),
      components: this.mergeByName(parent.components, child.components),
      commands: this.mergeById(parent.commands, child.commands),
      variables: this.deepMerge(parent.variables, child.variables),
      attributes: this.deepMerge(parent.attributes, child.attributes),
      events: this.deepMerge(parent.events, child.events),
      projects: child.projects ?? parent.projects,
      starterProjects: child.starterProjects ?? parent.starterProjects,
    };
  }

  private getComponentType(comp: any): string | undefined {
    if (!comp) return undefined;

    if (comp.container) return 'container';
    if (comp.kubernetes) return 'kubernetes';
    if (comp.image) return 'image';
    if (comp.volume) return 'volume';
    return undefined;
  }

  private mergeComponents(parentComp: any, childComp: any): any {
    if (parentComp && childComp && !this.getComponentType(childComp) && this.getComponentType(parentComp)) {
      return parentComp;
    }

    const parentType = this.getComponentType(parentComp);
    const childType = this.getComponentType(childComp);

    if (!childType) {
      return parentComp ?? childComp;
    }

    if (!parentComp) {
      return childComp;
    }

    if (parentType && childType && parentType !== childType) {
      return childComp;
    }

    const baseType = childType || parentType;

    return {
      ...parentComp,
      ...childComp,
      ...(baseType
        ? {
            [baseType]: this.deepMerge(
              parentComp?.[baseType],
              childComp?.[baseType]
            )
          }
        : {})
    };
  }

  private mergeByName(parent: any[] = [], child: any[] = []) {
    const map = new Map<string, any>();

    for (const item of parent) {
      map.set(item.name, item);
    }

    for (const item of child) {
      const existing = map.get(item.name);
      map.set(item.name, existing ? this.mergeComponents(existing, item) : item);
    }

    return Array.from(map.values());
  }

  private mergeById(parent: any[] = [], child: any[] = []) {
    const map = new Map<string, any>();

    for (const item of parent) {
      map.set(item.id, item);
    }

    for (const item of child) {
      if (map.has(item.id)) {
        map.set(item.id, this.deepMerge(map.get(item.id), item));
      } else {
        map.set(item.id, item);
      }
    }

    return Array.from(map.values());
  }

  private deepMerge(target: any, source: any): any {
    if (!source) return target;
    if (!target) return source;

    if (Array.isArray(target) && Array.isArray(source)) {
      return [...target, ...source];
    }

    if (typeof target === 'object' && typeof source === 'object') {
      const result = { ...target };
      for (const key in source) {
        if (source[key] !== undefined) {
          result[key] = source[key];
        }
      }
      return result;
    }

    return source ?? target;
  }
}
