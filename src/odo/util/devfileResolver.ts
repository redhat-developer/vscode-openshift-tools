/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import path from 'path';
import { DevfileInfo } from '../../devfile-registry/devfileInfo';
import { DevfileRegistry } from '../../devfile-registry/devfileRegistryWrapper';

export class DevfileResolver {

  private static parentCache = new Map<string, any>();

  static invalidateCache() {
    this.parentCache.clear();
  }

  async resolve(devfile: any): Promise<any> {
    const chain = await this.resolveParentChain(devfile);
    const mergedDevfile = this.mergeChain(chain);

    return this.normalizeResolvedDevfile(mergedDevfile);
  }

  private normalizeResolvedDevfile(devfile: any): any {
    const result = { ...devfile };
    if (result?.parent) {
      delete result.parent;
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

  private async resolveParentChain(devfile: any): Promise<any[]> {
    const chain: any[] = [];
    const visited = new Set<string>();

    let current = devfile;

    while (current?.parent) {
      const key = this.getParentKey(current.parent);

      if (visited.has(key)) {
        throw new Error(` ✗  Circular parent reference detected: ${key}`);
      }
      visited.add(key);

      const parent = await this.fetchParentDevfile(current.parent);

      chain.unshift(parent);
      current = parent;
    }

    chain.push(devfile);

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

  private async fetchFromRegistry(parent: any): Promise<any> {
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

      return registry.getRegistryDevfile(
          p.registry,
          p.id,
          versionEntry.version
      );
  }

  private async fetchParentDevfile(parent: any): Promise<any> {
    const key = this.getParentKey(parent);

    const cached = DevfileResolver.parentCache.get(key);
    if (cached) {
      return cached;
    }

    try {
      const devfile = await this.fetchFromRegistry(parent);

      DevfileResolver.parentCache.set(key, devfile);

      return devfile;
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
      if (map.has(item.name)) {
        const merged = this.mergeComponents(map.get(item.name), item);
        map.set(item.name, merged);
      } else {
        map.set(item.name, item);
      }
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
    if (!target) return source;
    if (!source) return target;

    const result = { ...target };

    for (const key of Object.keys(source)) {
      const srcVal = source[key];
      const tgtVal = target[key];

      if (
        typeof srcVal === 'object' &&
        srcVal !== null &&
        !Array.isArray(srcVal)
      ) {
        result[key] = this.deepMerge(tgtVal, srcVal);
      } else {
        result[key] = srcVal;
      }
    }

    return result;
  }
}
