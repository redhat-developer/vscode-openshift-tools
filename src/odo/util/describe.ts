/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as k8s from '@kubernetes/client-node';
import { AppsV1Api, CoreV1Api, NetworkingV1Api } from '@kubernetes/client-node';
import * as fs from 'fs/promises';
import { get as httpGet } from 'http';
import * as yaml from 'js-yaml';
import path from 'path';
import { KubeConfigInfo } from '../../util/kubeUtils';
import {
  Command,
  CommandInfo,
  ComponentDescription,
  ComponentItem,
  Container,
  Data,
  DevControlPlaneInfo,
  ForwardedPort,
  StarterProject,
} from '../componentTypeDescription';

/* ===========================================================
 * Cluster helper
 * =========================================================== */

async function checkClusterInfo(
  namespace: string,
  componentName: string,
  timeoutMs = 5000
): Promise<{ runningIn: string[]; runningOn: string[]; managedBy?: string; warnings?: string[] }> {

  const k8sConfigInfo = new KubeConfigInfo();
  const kc = k8sConfigInfo.getEffectiveKubeConfig();

  const coreApi: CoreV1Api = kc.makeApiClient(CoreV1Api)
  const k8sApi: NetworkingV1Api = kc.makeApiClient(NetworkingV1Api);
  const appsApi: AppsV1Api = kc.makeApiClient(AppsV1Api);

  const currentContext = k8sConfigInfo.findContext(kc.currentContext);
  const effectiveNamespace = namespace || currentContext.namespace || 'default';

  const timeoutPromise: Promise<{ runningIn: string[]; runningOn: string[]; managedBy: string; warning?: string }> = new Promise(
      (_, reject) => setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)
  );

  const localDevPromise = (async () => {
    const runningIn: string[] = [];
    const runningOn: string[] = [];
    const warnings: string[] = [];

    const devState = await readDevState();

    if (!devState || devState.componentName !== componentName) {
      return { runningIn, runningOn, warnings };
    }

    runningIn.push('Dev');

    const socket = await getSocketPath(devState.platform);

    if (!socket) {
      warnings.push(`Dev state found but ${devState.platform} socket not available`);
      return { runningIn, runningOn, warnings };
    }

    try {
      const containers = await getContainers(socket, componentName);

      const running = containers.some((c: any) => c.State === 'running');

      if (running) {
        runningOn.push(`local: ${devState.platform === 'podman' ? 'Podman' : 'Docker'}`);
      } else {
        warnings.push(`Dev state found but no running ${devState.platform} container`);
      }
    } catch (err: any) {
      warnings.push(`Failed to query ${devState.platform}: ${err.message}`);
    }

    return { runningIn, runningOn, warnings };
  })();


  const devPodsPromise: Promise<{ runningIn?: string[] }> = coreApi.listNamespacedPod({
      namespace: effectiveNamespace,
      labelSelector: `app.kubernetes.io/instance=${componentName}`
  }).then(res => {
    const runningPods = res.items.filter(
      pod => pod.metadata?.labels?.['app.kubernetes.io/component-source'] === 'dev'
        && pod.status?.phase === 'Running'
    )
    return { runningIn: runningPods.length > 0 ? ['Dev'] : [] }
  })

  const listIngressesPromise: Promise<{ runningIn?: string[] }> = k8sApi
    .listNamespacedIngress({
      namespace: effectiveNamespace,
      labelSelector: `app=${componentName}`
    })
    .then((res: k8s.V1IngressList) => {
      const runningIn = res.items
        .filter((i: k8s.V1Ingress) => i.metadata?.labels?.app === componentName)
        .map((i: k8s.V1Ingress) => i.metadata?.name ?? 'unknown');
      return { runningIn };
    });

  const listDeploymentsPromise: Promise<{ managedBy: string }> = appsApi
    .listNamespacedDeployment({
      namespace: effectiveNamespace,
      labelSelector: `app.kubernetes.io/instance=${componentName}`
    })
    .then((res) => {
      const items = res.body?.items ?? res.items ?? [];

      const managedBy =
        items[0]?.metadata?.labels?.['app.kubernetes.io/managed-by'];

      return { managedBy };
    });

  const clusterPromise = Promise.allSettled([ devPodsPromise, listIngressesPromise, listDeploymentsPromise ]).then(([dev, ing, dep]) => {

    const runningIn: string[] = []
    const runningOn: string[] = []
    let managedBy: string = undefined
    const warnings: string[] = [];

    if (dev.status === 'fulfilled') {
      if (dev.value.runningIn.length > 0) {
        runningIn.push('Dev')
        runningOn.push('cluster: Dev')
      }
    } else {
      const msg = extractK8sErrorMessage(dev.reason?.message ?? dev.reason)
      if (!warnings.includes(msg)) {
        warnings.push(msg)
      }
    }

    if (ing.status === 'fulfilled') {
      if (ing.value.runningIn.length > 0) {
        runningIn.push(...ing.value.runningIn)
        runningOn.push('cluster: Deploy')
      }
    } else {
      const msg = extractK8sErrorMessage(ing.reason?.message ?? ing.reason)
      if (!warnings.includes(msg)) {
        warnings.push(msg)
      }
    }

    if (dep.status === 'fulfilled') {
      managedBy = dep.value.managedBy
    } else {
      const msg = extractK8sErrorMessage(dep.reason?.message ?? dep.reason)
      if (!warnings.includes(msg)) {
        warnings.push(msg)
      }
    }

    return {
      runningIn,
      runningOn,
      managedBy,
      warnings: warnings.length ? warnings : undefined
    };
  });

  try {
    const result = await Promise.race([
      Promise.all([localDevPromise, clusterPromise]).then(([local, cluster]) => {
        // merge Dev + cluster results
        const runningIn = [...new Set([...(local.runningIn ?? []), ...(cluster.runningIn ?? [])])];
        const runningOn = [...new Set([...(local.runningOn ?? []), ...(cluster.runningOn ?? [])])];
        const warnings = [...(local.warnings ?? []), ...(cluster.warnings ?? [])];

        return {
          runningIn,
          runningOn,
          managedBy: cluster.managedBy,
          warnings: warnings.length ? [...new Set(warnings)] : undefined
        };
      }),
      timeoutPromise
    ]);

    return result;

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error while accessing the cluster';
    return { runningIn: [], runningOn: [], warnings: [`Cluster inspection failed: ${msg}`] };
  }
}

async function readDevState(): Promise<{ componentName: string; platform: string } | null> {
  try {
    const file = path.join(process.env.HOME || '', '.odo', 'devstate.json');

    const content = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(content);

    return parsed;
  } catch (err: any) {
    // File not found → normal case (no dev mode)
    if (err?.code === 'ENOENT') {
      return null;
    }

    // Invalid JSON or other issue → treat as warning-worthy upstream if needed
    return null;
  }
}

async function getSocketPath(runtime: string): Promise<string | null> {
  try {
    if (runtime === 'podman') {
      const userSocket = `/run/user/${process.getuid?.()}/podman/podman.sock`;
      try {
        await fs.access(userSocket);
        return userSocket;
      } catch {
        // fallback socket
        const fallback = '/run/podman/podman.sock';
        try {
          await fs.access(fallback);
          return fallback;
        } catch {
          return null;
        }
      }
    }

    if (runtime === 'docker') {
      const dockerSocket = '/var/run/docker.sock';
      try {
        await fs.access(dockerSocket);
        return dockerSocket;
      } catch {
        return null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function getContainers(socketPath: string, componentName: string): Promise<any[]> {
  return new Promise((resolve) => {
    if (!socketPath) {
      resolve([]);
      return;
    }

    const filters = { label: [`app.kubernetes.io/instance=${componentName}`] };
    const query = `?filters=${encodeURIComponent(JSON.stringify(filters))}`;

    const options = {
      socketPath,
      path: `/v1.40/containers/json${query}`,
      method: 'GET'
    };

    try {
      httpGet(options, (res) => {
        let data = '';

        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch {
            resolve([]);
          }
        });
      }).on('error', () => {
        resolve([]);
      });
    } catch {
      resolve([]);
    }
  });
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
  opts?: { namespace?: string; componentName?: string; timeoutMs?: number }
): Promise<ComponentDescription> {

  const resolvedDevfilePath = await resolveDevfile(devfilePath);

  const raw = await fs.readFile(resolvedDevfilePath, 'utf-8');
  const devfile: Data = resolvedDevfilePath.endsWith('.json')
    ? JSON.parse(raw)
    : (yaml.load(raw) as Data);

  const supportedOdoFeatures = detectSupportedFeatures(devfile);
  const devForwardedPorts = extractForwardedPorts(devfile);

  let runningIn: string[] = []
  let runningOn: string[] = []
  let managedBy = undefined
  let warnings: string[] = []
  let devControlPlane: ComponentDescription['devControlPlane'];

  // If namespace + componentName provided, query the cluster
  const clusterInfo = await checkClusterInfo(opts.namespace, opts.componentName, opts.timeoutMs ?? 3000)
  runningIn = clusterInfo.runningIn
  runningOn = clusterInfo.runningOn
  managedBy = clusterInfo.managedBy && clusterInfo.managedBy.length > 0 ? clusterInfo.managedBy : devfile ? 'odo' : 'Unknown';
  warnings = clusterInfo.warnings

  if (runningIn.includes('Dev')) {
    devControlPlane = [
      {
        platform: 'cluster',
        localPort: 20000,
        apiServerPath: '/api/v1/',
        webInterfacePath: '/'
      }
    ];
  }

  return {
    devfilePath: resolvedDevfilePath,
    devfileData: {
      devfile,
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
  }
): Promise<{ componentInfo: ComponentDescription; description: string }> {
  const { useBold = true } = options ?? {}
  const bold = useBold ? (t: string) => `\x1b[1m${t}\x1b[0m` : (t: string) => t

  const componentInfo = await getComponentDescription(devfilePath, options)
  const devfile = componentInfo.devfileData.devfile
  const supportedOdoFeatures = componentInfo.devfileData.supportedOdoFeatures
  const devForwardedPorts = componentInfo.devForwardedPorts

  const lines: string[] = []

  appendWarnings(lines, componentInfo.warnings ?? [], bold)
  appendMetadata(lines, devfile.metadata, devfile.schemaVersion, bold)
  appendRunningIn(lines, componentInfo.runningIn, bold)
  appendRunningOn(lines, componentInfo.runningOn, bold)
  appendDevControlPlane(lines, componentInfo.devControlPlane, bold)
  appendForwardedPorts(lines, devForwardedPorts, bold)
  appendSupportedFeatures(lines, supportedOdoFeatures, bold)
  appendCommands(lines, devfile.commands, bold)
  appendContainerComponents(lines, devfile.components, bold)
  appendKubernetesComponents(lines, devfile.components, bold)
  appendVolumes(lines, devfile.components, bold)
  appendStarterProjects(lines, devfile.starterProjects, bold)
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

async function resolveDevfile(devfilePath: string): Promise<string> {
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

    throw new Error(' ✗  The current directory does not represent an odo component.');
}

function flattenCommands(devfile): CommandInfo[] {
  return (devfile.commands ?? []).map(cmd => {
    const exec = cmd.exec

    return {
      name: cmd.id,
      type: 'exec',
      group: exec?.group?.kind,
      isDefault: exec?.group?.isDefault ?? false,
      commandLine: exec?.commandLine,
      component: exec?.component,
      componentType: 'container'
    }
  })
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
  lines.push('');
}

function appendRunningIn(lines: string[], runningIn: string[], bold: (text: string) => string) {
  lines.push('')

  if (!runningIn.length) {
    lines.push('Running in: None')
    return
  }

  lines.push(`Running in: ${runningIn.join(', ')}`)
}

function appendRunningOn(lines: string[], runningOn: string[], bold: (t: string) => string) {
  if (!runningOn.length) return

  lines.push('')
  lines.push(`${bold('Running on')}:`)

  runningOn.forEach(r => {
    lines.push(` •  ${r}`)
  })
}

function appendDevControlPlane(lines: string[], devControlPlane: DevControlPlaneInfo | undefined, bold: (t: string) => string) {
  if (!devControlPlane?.length) return;

  lines.push('');
  lines.push(`${bold('Dev Control Plane')}:`);

  devControlPlane.forEach(cp => {
    lines.push(` •  ${cp.platform}`);

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

function appendCommands(lines: string[], commands: Command[], bold: (text: string) => string) {
  if (!commands?.length) return;
  lines.push(`${bold('Commands:')}`);
  for (const cmd of commands) {
    const type = cmd.exec ? 'exec' : cmd.composite ? 'composite' : 'unknown';
    lines.push(` •  ${cmd.id}`);
    lines.push(`      ${bold('Type:')} ${type}`);

    if (cmd.exec) {
      const group = cmd.exec.group?.kind ?? 'N/A';
      lines.push(`      ${bold('Group:')} ${group}`);
      lines.push(`      ${bold('Command Line:')} "${cmd.exec.commandLine}"`);
      lines.push(`      ${bold('Component:')} ${cmd.exec.component}`);
      lines.push(`      ${bold('Component Type:')} container`);
    } else if (cmd.composite) {
      const group = cmd.composite.group.kind;
      lines.push(`      ${bold('Group:')} ${group}`);
      lines.push(`      ${bold('Commands:')} ${cmd.composite.commands.join(', ')}`);
    }

    lines.push('');
  }
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
    lines.push(`    ${bold('Resource:')} ${comp.kubernetes?.name}`);
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
    lines.push(` •  [cluster] ${port.localAddress}:${port.localPort} -> ${port.containerName}:${port.containerPort}`);
    if (port.name) {
      lines.push(`    Name: ${port.name}`)
    }
  }

  lines.push('');
}

/* ===========================================================
 * Data Extraction Utilities
 * =========================================================== */

function detectSupportedFeatures(devfile: Data): {
  dev: boolean;
  deploy: boolean;
  debug: boolean;
} {
  const commandKinds = new Set(
    devfile.commands
      .map((c) => c.exec?.group?.kind ?? c.composite?.group?.kind)
      .filter(Boolean)
  );

  return {
    dev: commandKinds.has('run') || commandKinds.has('build'),
    deploy: commandKinds.has('deploy'),
    debug: commandKinds.has('debug'),
  };
}

function extractForwardedPorts(devfile: Data): ForwardedPort[] {
  const ports: ForwardedPort[] = [];
  for (const comp of devfile.components ?? []) {
    if (comp.container?.endpoints) {
      for (const ep of comp.container.endpoints) {
        ports.push({
          containerName: comp.name,
          localAddress: '127.0.0.1',
          localPort: ep.targetPort,
          containerPort: ep.targetPort,
          name: ep.name
        });
      }
    }
  }
  return ports;
}
