/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { AppsV1Api, NetworkingV1Api } from '@kubernetes/client-node';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import path from 'path';
import { DevfileInfo } from '../../devfile-registry/devfileInfo';
import { DevfileRegistry } from '../../devfile-registry/devfileRegistryWrapper';
import { KubeConfigInfo } from '../../util/kubeUtils';
import {
  CommandInfo,
  ComponentDescription,
  ComponentItem,
  Container,
  Data,
  DevControlPlaneInfo,
  ForwardedPort,
  StarterProject
} from '../componentTypeDescription';

/* ===========================================================
 * Cluster helper
 * =========================================================== */

async function checkClusterInfo(namespace: string, componentName: string, timeoutMs = 3000): Promise<{
  runningIn: string[];
  runningOn: string[];
  managedBy?: string;
  warnings?: string[];
}> {
  const k8sConfigInfo = new KubeConfigInfo();
  const kc = k8sConfigInfo.getEffectiveKubeConfig();

  const k8sApi: NetworkingV1Api = kc.makeApiClient(NetworkingV1Api);
  const appsApi: AppsV1Api = kc.makeApiClient(AppsV1Api);

  const currentContext = k8sConfigInfo.findContext(kc.currentContext);
  const effectiveNamespace =
    namespace || currentContext.namespace || 'default';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const [ing, dep] = await Promise.all([
      k8sApi.listNamespacedIngress(
        {
          namespace: effectiveNamespace,
          labelSelector: `app.kubernetes.io/instance=${componentName}`
        },
        undefined,
        undefined,
        undefined,
        { signal: controller.signal as any }
      ),

      appsApi.listNamespacedDeployment(
        {
          namespace: effectiveNamespace,
          labelSelector: `app.kubernetes.io/instance=${componentName}`
        },
        undefined,
        undefined,
        undefined,
        { signal: controller.signal as any }
      )
    ]);

    const runningIn = (ing.items ?? [])
      .map(i => i.metadata?.name)
      .filter(Boolean);

    const runningOn = runningIn.length > 0 ? ['cluster: Deploy'] : [];

    const managedBy =
      dep.items?.[0]?.metadata?.labels?.[
        'app.kubernetes.io/managed-by'
      ];

    return {
      runningIn,
      runningOn,
      managedBy
    };

  } catch (err: any) {
    const isAbort =
      err?.name === 'AbortError' ||
      err?.message?.toLowerCase?.().includes('abort');

    return {
      runningIn: [],
      runningOn: [],
      managedBy: undefined,
      warnings: [
        isAbort
          ? `Cluster request timed out after ${timeoutMs}ms`
          : extractK8sErrorMessage(err)
      ]
    };

  } finally {
    clearTimeout(timeout);
  }
}

type DevState = {
  pid: number;
  platform: 'cluster' | 'podman' | 'docker' | string;
  forwardedPorts?: {
    containerName: string;
    portName?: string;
    isDebug?: boolean;
    localAddress: string;
    localPort: number;
    containerPort: number;
    exposure?: string;
  }[];
  apiServerPort?: number;
};

async function readDevState(devfilePath: string): Promise< DevState | null> {
  try {
    const file = path.join(path.dirname(devfilePath), '.odo', 'devstate.json');
    return JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch {
    return null;
  }
}

function extractK8sErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';

  const text = typeof err === 'string' ? err : err instanceof Error ? err.message : String(err);

  const match = text.match(/Message:\s*([^\n]+)/i);
  if (match) {
    return match[1].trim();
  }

  return text.split('\n')[0].trim();
}

/* ===========================================================
 * Exported functions
 * =========================================================== */

export async function getComponentDescription(
  devfilePath: string,
  opts?: { namespace?: string; componentName?: string; timeoutMs?: number; debug?: boolean }
): Promise<ComponentDescription> {
  const resolver = new DevfileResolver();
  const resolvedDevfilePath = await DevfileResolver.resolveDevfilePath(devfilePath);
  if (!resolvedDevfilePath) {
    throw new Error(`No devfile found at: ${devfilePath}`);
  }

  const devfile = await resolver.loadDevfile(resolvedDevfilePath);
  const mergedDevfile = await resolver.resolve(devfile);


  const normalizedCommands = normalizeCommands(mergedDevfile);
  const supportedOdoFeatures = detectSupportedFeatures(normalizedCommands);

  let runningIn: string[] = [];
  let runningOn: string[] = [];
  let managedBy = undefined;
  let warnings: string[] = [];
  let devForwardedPorts:  ForwardedPort[] = [];
  const devControlPlane: ComponentDescription['devControlPlane'] = [];

  const devstate = await readDevState(resolvedDevfilePath);
  if (devstate) {
    const runtime = devstate.platform ?? 'unknown';

    runningIn.push('Dev');
    runningOn.push(`${runtime}: Dev`);

    devForwardedPorts = extractForwardedPortsFromDevState(devstate);

    if (devstate.apiServerPort) {
      if (runtime !== 'cluster') {
        devControlPlane.push(  {
          platform: 'cluster',
          localPort: devstate.apiServerPort,
          apiServerPath: '/api/v1/',
          webInterfacePath: '/'
        });
      }
      devControlPlane.push({
          platform: runtime,
          localPort: devstate.apiServerPort,
          apiServerPath: '/api/v1/',
          webInterfacePath: '/'
        });
    }
  } else {
    const clusterInfo = await checkClusterInfo(opts.namespace, opts.componentName, opts.timeoutMs ?? 3000)
    runningIn = clusterInfo.runningIn
    runningOn = clusterInfo.runningOn
    managedBy = clusterInfo.managedBy && clusterInfo.managedBy.length > 0 ? clusterInfo.managedBy : devfile ? 'odo' : 'Unknown';
    warnings = clusterInfo.warnings
  }

  return {
    devfilePath: resolvedDevfilePath,
    devfileData: {
      devfile: mergedDevfile,
      commands: normalizedCommands,
      supportedOdoFeatures,
    },
    devForwardedPorts,
    runningIn,
    runningOn,
    devControlPlane,
    managedBy,
    warnings
  };
}

export async function describeComponentYAML(
  devfilePath: string,
  options?: {
    useBold?: boolean
    namespace?: string
    componentName?: string
    timeoutMs?: number
    debug?: boolean
  }
): Promise<{ componentInfo: ComponentDescription; description: string }> {
  const { useBold = true } = options ?? {}
  const bold = useBold ? (t: string) => `\x1b[1m${t}\x1b[0m` : (t: string) => t

  const componentInfo = await getComponentDescription(devfilePath, options)
  const devfile = componentInfo.devfileData.devfile;
  const supportedOdoFeatures = componentInfo.devfileData.supportedOdoFeatures;
  const devForwardedPorts = componentInfo.devForwardedPorts

  const lines: string[] = []

  appendWarnings(lines, componentInfo.warnings ?? [], bold)
  appendMetadata(lines, devfile.metadata, devfile.schemaVersion, bold)
  appendRunningIn(lines, componentInfo.runningIn, bold)
  appendRunningOn(lines, componentInfo.runningOn, bold)
  appendDevControlPlane(lines, componentInfo.devControlPlane, bold)
  appendForwardedPorts(lines, devForwardedPorts, bold)
  appendSupportedFeatures(lines, supportedOdoFeatures, bold)
  appendCommands(lines, flattenCommands(devfile), bold)
  appendContainerComponents(lines, devfile.components, bold)
  appendKubernetesComponents(lines, devfile.components, bold)
  appendVolumes(lines, devfile.components, bold)
  if (options?.debug) {
    appendStarterProjects(lines, devfile.starterProjects, bold)
  }
  appendEvents(lines, devfile.events, bold)
  appendManagedBy(lines, componentInfo.managedBy, bold)

  return { componentInfo, description: lines.join('\n') }
}

export async function describeComponentJSON(componentInfo: ComponentDescription) {
  return JSON.stringify({
    devfilePath: componentInfo.devfilePath,
    devfileData: {
      devfile: componentInfo.devfileData.devfile,
      commands: flattenCommands(componentInfo.devfileData.devfile),
      supportedOdoFeatures: componentInfo.devfileData.supportedOdoFeatures
    },
    devControlPlane: componentInfo.devControlPlane,
    devForwardedPorts: componentInfo.devForwardedPorts,
    runningIn:
      componentInfo.runningIn?.length
        ? componentInfo.runningIn
        : null,

    managedBy: componentInfo.managedBy
  }, null, 2)
}

/* ===========================================================
 * Private helpers
 * =========================================================== */

class DevfileResolver {

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

function flattenCommands(devfile): CommandInfo[] {
  return (devfile.commands ?? []).map(cmd => {

    if (cmd.exec) {
      return {
        name: cmd.id,
        type: 'exec',
        group: cmd.exec.group?.kind,
        commandLine: cmd.exec.commandLine,
        component: cmd.exec.component,
        componentType: 'container'
      };
    }

    if (cmd.apply) {
      return {
        name: cmd.id,
        type: 'apply',
        component: cmd.apply.component,
        componentType: cmd.apply.componentType ?? inferComponentType(devfile, cmd.apply.component),
        imageName: inferImageName(devfile, cmd.apply.component)
      };
    }

    if (cmd.composite) {
      return {
        name: cmd.id,
        type: 'composite',
        group: cmd.composite.group?.kind,
        commands: cmd.composite.commands
      };
    }

    return {
      name: cmd.id,
      type: 'unknown'
    };
  });
}

function inferComponentType(devfile, componentName: string): string {
  const comp = (devfile.components ?? []).find(c => c.name === componentName);

  if (!comp) return 'unknown';
  if (comp.container) return 'container';
  if (comp.kubernetes) return 'kubernetes';
  if (comp.image) return 'image';

  return 'unknown';
}

function inferImageName(devfile, componentName: string): string | undefined {
  const comp = (devfile.components ?? []).find(c => c.name === componentName);
  return comp?.image?.imageName;
}

function appendWarnings(lines: string[], warnings: string[], bold: (text: string) => string) {
  if (!warnings || warnings.length === 0) {
    return ''
  }

  const BORDER = '='.repeat(49)

  lines.push(BORDER)
  for (const w of warnings) {
    lines.push(`⚠  failed to get ingresses/routes: ${w}`)
  }
  lines.push(BORDER)

  return lines.join('\n')
}

function appendMetadata(lines: string[], meta: Data['metadata'], schemaVersion: string | undefined, bold: (text: string) => string) {
  lines.push(`${bold('Name:')} ${meta.name}`);
  if (meta.displayName) lines.push(`${bold('Display Name:')} ${meta.displayName}`);
  if (meta.projectType) lines.push(`${bold('Project Type:')} ${meta.projectType}`);
  if (meta.language) lines.push(`${bold('Language:')} ${meta.language}`);
  if (meta.version) lines.push(`${bold('Version:')} ${meta.version}`);
  if (meta.description) lines.push(`${bold('Description:')} ${meta.description}`);
  if (meta.tags?.length) lines.push(`${bold('Tags:')} ${meta.tags.join(', ')}`);
  if (schemaVersion) lines.push(`${bold('Schema Version:')} ${schemaVersion}`);

  lines.push('')
}

function appendRunningIn(lines: string[], runningIn: string[], bold: (text: string) => string) {
  if (!runningIn.length) {
    lines.push('Running in: None')
  } else {
    lines.push(`Running in: ${runningIn.join(', ')}`)
  }

  lines.push('')
}

function appendRunningOn(lines: string[], runningOn: string[], bold: (t: string) => string) {
  if (!runningOn.length) return

  lines.push(`${bold('Running on')}:`)

  runningOn.forEach(r => {
    lines.push(` •  ${r}`)
  })

  lines.push('');
}

function appendDevControlPlane(lines: string[], devControlPlane: DevControlPlaneInfo | undefined, bold: (t: string) => string) {
  if (!devControlPlane?.length) return;

  lines.push(`${bold('Dev Control Plane')}:`);

  devControlPlane.forEach(cp => {
    lines.push(bold(` •  ${cp.platform}`));

    if (cp.localPort) {
      if (cp.apiServerPath) {
        lines.push(
          `      API: http://localhost:${cp.localPort}${cp.apiServerPath}`
        );
      }

      if (cp.webInterfacePath) {
        lines.push(
          `      Web UI: http://localhost:${cp.localPort}${cp.webInterfacePath}`
        );
      }
    }
  });

  lines.push('');
}

function appendManagedBy(lines: string[], managedBy: string, bold: (text: string) => string) {
  if (!managedBy) return

  lines.push(`${bold('Managed by:')} ${managedBy}`)
  lines.push('')
}

function appendSupportedFeatures(lines: string[], features: { dev: boolean; deploy: boolean; debug: boolean }, bold: (text: string) => string) {
  lines.push(`${bold('Supported odo features:')}`);
  lines.push(` •  Dev: ${features.dev}`);
  lines.push(` •  Deploy: ${features.deploy}`);
  lines.push(` •  Debug: ${features.debug}`);
  lines.push('');
}

function appendCommands(lines: string[], commands: any[], bold: (text: string) => string) {
  if (!commands?.length) return;

  lines.push(`${bold('Commands:')}`);

  for (const cmd of commands) {
    lines.push(` •  ${cmd.name}`);
    lines.push(`      ${bold('Type:')} ${cmd.type}`);

    if (cmd.type === 'exec') {
      lines.push(`      ${bold('Group:')} ${cmd.group ?? 'N/A'}`);
      lines.push(`      ${bold('Command Line:')} "${cmd.commandLine}"`);
      lines.push(`      ${bold('Component:')} ${cmd.component}`);
      lines.push(`      ${bold('Component Type:')} ${cmd.componentType}`);
    } else if (cmd.type === 'composite') {
      if (cmd.group) {
        lines.push(`      ${bold('Group:')} ${cmd.group}`);
      }
      if (cmd.commands?.length) {
        lines.push(`      ${bold('Commands:')} ${cmd.commands.join(', ')}`);
      }
    } else if (cmd.type === 'apply') {
      lines.push(`      ${bold('Component:')} ${cmd.component}`);
      lines.push(`      ${bold('Component Type:')} ${cmd.componentType}`);

      if (cmd.imageName) {
        lines.push(`      ${bold('Image Name:')} ${cmd.imageName}`);
      }
    }
  }

  lines.push('');
}

function appendContainerComponents(lines: string[], components: ComponentItem[], bold: (text: string) => string) {
  const containers = components?.filter((c) => c.container);
  if (!containers?.length) return;

  lines.push(`${bold('Container components:')}`);
  for (const comp of containers) {
    const cont = comp.container as Container;
    lines.push(` •  ${comp.name}`);
    lines.push(`    ${bold('Source Mapping:')} /projects`);
    if (cont.endpoints?.length) {
      lines.push(`    ${bold('Endpoints:')}`);
      for (const ep of cont.endpoints) {
        lines.push(`      - ${ep.name} (${ep.targetPort})`);
      }
    }

    lines.push('');
  }
}

function appendKubernetesComponents(lines: string[], components: ComponentItem[], bold: (text: string) => string) {
  const kube = components?.filter((c) => c.kubernetes);
  if (!kube?.length) return;

  lines.push(`${bold('Kubernetes components:')}`);

  for (const comp of kube) {
    lines.push(` •  ${comp.name}`);
  }

  lines.push('');
}

function appendVolumes(lines: string[], components: ComponentItem[], bold: (text: string) => string) {
  const allVolumes: Data['components'][number]['container']['volumeMounts'] = [];
  for (const c of components ?? []) {
    if (c.container?.volumeMounts?.length) {
      allVolumes.push(...c.container.volumeMounts);
    }
  }
  if (!allVolumes.length) return;

  lines.push(`${bold('Volumes:')}`);
  for (const v of allVolumes) {
    lines.push(` •  ${v.name} mounted at ${v.path}`);
  }

  lines.push('');
}

function appendStarterProjects(lines: string[], starters?: StarterProject[], bold?: (text: string) => string) {
  if (!starters?.length) return;

  lines.push(`${bold?.('Starter Projects:')}`);

  for (const sp of starters) {
    lines.push(` •  ${sp.name}`);
    if (sp.description) lines.push(`    ${bold?.('Description:')} ${sp.description}`);
    if (sp.git) {
      const remotes = Object.entries(sp.git.remotes ?? {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      lines.push(`    ${bold?.('Git Remotes:')} ${remotes}`);
    }
    if (sp.zip) lines.push(`    ${bold?.('Zip:')} ${sp.zip.location}`);
  }

  lines.push('');
}

function appendEvents(lines: string[], events?: Data['events'], bold?: (text: string) => string) {
  if (!events) return;

  const keys = Object.keys(events) as (keyof typeof events)[];
  if (!keys.length) return;

  lines.push(`${bold?.('Events:')}`);

  for (const key of keys) {
    const val = events[key];
    if (Array.isArray(val)) lines.push(` •  ${key}: ${val.join(', ')}`);
  }

  lines.push('');
}

function appendForwardedPorts(lines: string[], ports: ForwardedPort[], bold: (text: string) => string) {
  if (!ports?.length) return;

  lines.push(`${bold('Forwarded ports:')}`);

  for (const port of ports) {
    lines.push(` •  [${port.platform}] ${port.localAddress}:${port.localPort} -> ${port.containerName}:${port.containerPort}`)
    if (port.name) {
      lines.push(`    Name: ${port.name}`);
    }
    if (port.exposure) {
      lines.push(`    Exposure: ${port.exposure}`);
    }
    if (port.isDebug) {
      lines.push('    Debug: true');
    }
  }

  lines.push('');
}

/* ===========================================================
 * Data Extraction Utilities
 * =========================================================== */

function normalizeCommands(devfile: any): any[] {
  const commands = devfile.commands || [];

  return commands.map(cmd => {
    if (cmd.exec) {
      return {
        name: cmd.id,
        group: cmd.exec.group?.kind,
        isDefault: cmd.exec.group?.isDefault,
        type: 'exec'
      };
    }

    if (cmd.apply) {
      return {
        name: cmd.id,
        type: 'apply'
      };
    }

    if (cmd.composite) {
      return {
        name: cmd.id,
        group: cmd.composite.group?.kind,
        isDefault: cmd.composite.group?.isDefault,
        type: 'composite'
      };
    }

    return { name: cmd.id };
  });
}

function detectSupportedFeatures(commands: any[]) {
  return {
    dev: commands.some(c => c.group === 'run'),
    debug: commands.some(c => c.group === 'debug'),
    deploy: commands.some(c => c.group === 'deploy' || c.type === 'apply'),
  };
}

function extractForwardedPortsFromDevState(devState): ForwardedPort[] {
  if (!devState?.forwardedPorts) return [];

  const runtime = devState.platform ?? 'unknown';
  const base = devState.forwardedPorts.map(p => ({
    containerName: p.containerName,
    localAddress: p.localAddress,
    localPort: p.localPort,
    containerPort: p.containerPort,
    name: p.portName,
    isDebug: p.isDebug,
    exposure: p.exposure
  }));

  const forwardedPorts: ForwardedPort[] = [];

  if (runtime !== 'cluster') {
    forwardedPorts.push(...base.map(p => ({ ...p, platform: 'cluster' })));
  }

  forwardedPorts.push(...base.map(p => ({...p, platform: runtime})));

  return forwardedPorts;
}
