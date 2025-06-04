/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import type { Context, KubernetesObject } from '@kubernetes/client-node';
import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';
import {
    commands,
    Disposable,
    Event,
    EventEmitter,
    extensions,
    TextDocumentShowOptions,
    ThemeIcon,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    TreeView,
    Uri,
    version,
    window,
    workspace
} from 'vscode';
import { CommandOption, CommandText } from './base/command';
import { ExecutionContext } from './cli';
import * as Helm from './helm/helm';
import { HelmRepo } from './helm/helmChartType';
import { getOutputFormat, helmfsUri, kubefsUri } from './k8s/vfs/kuberesources.utils';
import { Oc } from './oc/ocWrapper';
import { Component } from './openshift/component';
import { getServiceKindStubs, getServices } from './openshift/serviceHelpers';
import { PortForward } from './port-forward';
import { getKubeConfigFiles, getNamespaceKind, isOpenShiftCluster, KubeConfigInfo } from './util/kubeUtils';
import { LoginUtil } from './util/loginUtil';
import { Platform } from './util/platform';
import { Progress } from './util/progress';
import { imagePath } from './util/utils';
import { FileContentChangeNotifier, WatchUtil } from './util/watch';
import { vsCommand } from './vscommand';
import { CustomResourceDefinitionStub, K8sResourceKind } from './webview/common/createServiceTypes';
import { OpenShiftTerminalManager } from './webview/openshift-terminal/openShiftTerminal';

type ExplorerItem = KubernetesObject | Helm.HelmRelease | Context | TreeItem | OpenShiftObject | HelmRepo | PipelineTasks;

export type OpenShiftObject = {
    kind: string,
    metadata: {
        name: string
    },
}

export type PipelineTasks = {
    name: string
    context: string
}

export type task = {
    [key: string]: string
}

export interface OtherObject extends KubernetesObject {
    spec?: {
        tasks?: task[]
    },
    status?: {
        [key: string]: string
    },
}

export interface DeploymentPodErrors {
    inCrashLoopBackOff: boolean,
    messages: string[]
}

type PackageJSON = {
    version: string;
    bugs: string;
};

async function createOrSetProjectItem(projectName: string, executionContext?: ExecutionContext): Promise<ExplorerItem> {
    const kind = await getNamespaceKind(executionContext);
    return {
        label: `${projectName}`,
        description: `Missing ${kind}. Create new or set active ${kind}`,
        tooltip: `${projectName} - Missing ${kind}. Create new or set active ${kind}`,
        iconPath: new ThemeIcon('warning'),
        command: {
            title: `Create new or set active ${kind}`,
            command: 'openshift.project.set'
        }
    };
}

function couldNotGetItem(item: string, clusterURL: string): ExplorerItem {
    return {
        label: `Couldn't get ${item} for server ${clusterURL}`,
        iconPath: new ThemeIcon('error')
    };
}

export class OpenShiftExplorer implements TreeDataProvider<ExplorerItem>, Disposable {
    private static instance: OpenShiftExplorer;

    private treeView: TreeView<ExplorerItem>;

    private kubeConfigWatchers: FileContentChangeNotifier[];
    private kubeContext: Context;
    private kubeConfigInfo: KubeConfigInfo;

    private executionContext: ExecutionContext = new ExecutionContext();

    private eventEmitter: EventEmitter<ExplorerItem | undefined> =
        new EventEmitter<ExplorerItem | undefined>();

    readonly onDidChangeTreeData: Event<ExplorerItem | undefined> = this
        .eventEmitter.event;

    public onDidChangeContextEmitter = new EventEmitter<string>();

    private constructor() {
        try {
            this.kubeConfigInfo = new KubeConfigInfo();
            this.kubeContext = this.kubeConfigInfo.getEffectiveKubeConfig().getContextObject(this.kubeConfigInfo.getEffectiveKubeConfig().currentContext);
        } catch {
            // ignore config loading error and let odo report it on first call
        }
        try {
            const kubeconfigFiles = getKubeConfigFiles();
            this.kubeConfigWatchers = (!kubeconfigFiles || kubeconfigFiles.length === 0) ? [] :
                kubeconfigFiles.map(kubeconfigFile => WatchUtil.watchFileForContextChange(path.dirname(kubeconfigFile), path.basename(kubeconfigFile)));
            if (this.kubeConfigWatchers.length === 0) {
                void window.showWarningMessage('Kubernetes configuration file(s) not found. Make sure that "${HOME}/.kube/config" file exists or "KUBECONFIG" environment variable is properly configured');
            }
        } catch {
            void window.showWarningMessage('Couldn\'t install watcher for Kubernetes configuration file. OpenShift Application Explorer view won\'t be updated automatically.');
        }
        for (const fsw of this.kubeConfigWatchers) {
            fsw.emitter?.on('file-changed', () => {
                const kci2 = new KubeConfigInfo();
                const kc2 = kci2.getEffectiveKubeConfig();
                const newCtx = kc2.getContextObject(kc2.currentContext);
                if (Boolean(this.kubeContext) !== Boolean(newCtx)
                    || (this.kubeContext?.cluster !== newCtx?.cluster
                        || this.kubeContext?.user !== newCtx?.user
                        || this.kubeContext?.namespace !== newCtx?.namespace)) {
                    this.refresh();
                    this.onDidChangeContextEmitter.fire(newCtx?.name); // newCtx can be 'null'
                }
                this.kubeContext = newCtx;
                this.kubeConfigInfo = kci2;
            });
        }
        this.treeView = window.createTreeView<ExplorerItem>('openshiftProjectExplorer', {
            treeDataProvider: this,
        });
        Component.onDidStateChanged((_context) => {
            this.refresh();
        });
    }

    public static getInstance(): OpenShiftExplorer {
        if (!OpenShiftExplorer.instance) {
            OpenShiftExplorer.instance = new OpenShiftExplorer();
        }
        return OpenShiftExplorer.instance;
    }

    private generateOpenshiftProjectContextValue(namespace: string): Thenable<string> {
        const contextValue = `openshift.project.${namespace}`;
        const allTrue = arr => arr.every(Boolean);

        return Promise.all([
                Oc.Instance.canDeleteNamespace(namespace),
                Oc.Instance.getProjects(true, this.executionContext)
                    .then((clusterProjects) => {
                        const existing = clusterProjects.find((project) => project.name === namespace);
                        return existing !== undefined;
                    })
            ])
            .then(result => (allTrue(result) ? `${contextValue}.can-delete` : contextValue));
    }

    // eslint-disable-next-line class-methods-use-this
    async getTreeItem(element: ExplorerItem): Promise<TreeItem> {
        if ('command' in element || ('label' in element && 'iconPath' in element)) {
            return element;
        }

        if ('label' in element) {
            return {
                contextValue: 'openshift.openConfigFile',
                label: element.label,
                collapsibleState: TreeItemCollapsibleState.None,
                tooltip: element.label as string,
                description: element.description,
                iconPath: new ThemeIcon('file')
            };
        }

        // check if element is Context instance
        if ('name' in element && 'cluster' in element && 'user' in element) { // Context instance could be without namespace
            void commands.executeCommand('setContext', 'isLoggedIn', true);
            return {
                contextValue: 'openshift.k8sContext',
                label: this.kubeConfigInfo.getEffectiveKubeConfig().getCluster(element.cluster)?.server,
                collapsibleState: TreeItemCollapsibleState.Collapsed,
                iconPath: imagePath('context/cluster-node.png')
            };
        }

        if ('name' in element && 'url' in element) {
            return {
                contextValue: 'openshift.helm.repo',
                label: element.name,
                tooltip: element.url,
                collapsibleState: TreeItemCollapsibleState.None,
                iconPath: new ThemeIcon('repo')
            };
        }

        if ('name' in element && 'context' in element) {
            return {
                contextValue: 'openshift.pipeline.tasks',
                label: element.name,
                tooltip: 'Task Name',
                collapsibleState: TreeItemCollapsibleState.None,
                iconPath: new ThemeIcon('repo')
            };
        }

        // It's a Helm installation
        if ('chart' in element) {
            if (element.chart === 'noChart') {
                return {
                    label: 'No charts were installed'
                };
            }
            return {
                contextValue: 'openshift.k8sObject.helm',
                label: element.name,
                collapsibleState: TreeItemCollapsibleState.None,
                description: element.status,
                iconPath: element.status === 'failed' ? imagePath('context/helmFailed.svg') : imagePath('context/helmDeployed.svg'),
                tooltip: `Chart version: ${element.chart}\nApp version: ${element.app_version}\n`,
                command: {
                    title: 'Load',
                    command: 'openshift.resource.load',
                    arguments: element.status === 'deployed' ? [element] : undefined
                }
            };
        }

        // otherwise it is a KubernetesObject instance
        if ('kind' in element) {
            if (element.kind === 'project') {
                return this.generateOpenshiftProjectContextValue(element.metadata.name)
                    .then(namespace => {
                        return {
                            contextValue: namespace,
                            label: element.metadata.name,
                            collapsibleState: TreeItemCollapsibleState.Collapsed,
                            iconPath: imagePath('context/project-node.png')
                        }
                    });
            } else if (element.kind === 'helmContexts') {
                return {
                    label: 'Helm',
                    collapsibleState: TreeItemCollapsibleState.Collapsed
                }
            } else if (element.kind === 'helmRepos') {
                return {
                    contextValue: 'openshift.helm.repos',
                    label: element.metadata.name,
                    collapsibleState: TreeItemCollapsibleState.Collapsed
                }
            } else if (element.kind === 'Pod' && element ) {
                const contextElement = element as OtherObject;
                const podLabel = (contextElement as KubernetesObject).metadata?.name ?? 'unknown';
                const podKind = (contextElement as KubernetesObject).kind ?? 'unknown';
                return {
                    contextValue: 'openshift.k8sObject.pod',
                    label: podLabel,
                    description: `${podKind.substring(0, 1).toLocaleUpperCase()}${podKind.substring(1)}`,
                    collapsibleState: TreeItemCollapsibleState.None,
                    iconPath: contextElement.status.phase === 'Running' ? imagePath('context/runningPod.svg') : imagePath('context/notReadyPod.svg'),
                    tooltip: `${contextElement.status.phase}\n${contextElement.status.podIP ? contextElement.status.podIP : ''}`,
                    command: {
                        title: 'Load',
                        command: 'openshift.resource.load',
                        arguments: contextElement.status.phase === 'Running' ? [contextElement] : undefined
                    }
                }
            }
            const contextElement: OtherObject = element;
            if (!contextElement.spec) {
                const elementValue = this.makeCaps(element.metadata.name);
                return {
                    contextValue: `openshift.k8sobject.${element.kind}`,
                    label: elementValue,
                    collapsibleState: TreeItemCollapsibleState.Collapsed
                }
            }
            return this.getDeploymentItem(element);
        }
        return {
            label: 'Unknown element'
        }
    }

    private getDeploymentIconSuffix(pods: OtherObject[]): string {
        // Find all not 'Running' pods
        const notRunning = pods.filter((pod) => pod.status && pod.status.phase !== 'Running');
        if (notRunning.length === 0) {
            return '-green'; // All running - return 'green'
        }
        // Find any 'Failed' or 'Unknown' pod - if any return error ('red')
        const failed = notRunning.find((pod) => pod.status &&
            (pod.status.phase === 'Failed' || pod.status.phase === 'Unknown'));
        if (failed) {
            return '-red'; // At least one failed or unknown - return 'red'
        }
        // Find any 'Pending' pod - if any return pending ('yellow')
        const pending = notRunning.find((pod) => pod.status && pod.status.phase === 'Pending');
        return pending ? '-yellow' : '';
    }

    /*
     * Search for 'CrashLoopBackOff` in Pod's opbect:
     * status:
     *   containerStatuses:
     *     state:
     *       waiting:
     *         message: |
     *           container create failed: time="2024-05-28T10:30:28Z" level=error msg="runc create failed: unable to start container process: exec: \"asdf\": executable file not found in $PATH"
     *         reason: CreateContainerError
     */
    private detectCrashLoopBackOff(pods): DeploymentPodErrors {
        let inCrashLoopBackOff = false;
        const messages: string[] = [];

        // Search for Pod continers' errors
        pods.forEach((pod) => {
            if (pod.status?.containerStatuses) {
                pod.status.containerStatuses.forEach((cs) => {
                    if (cs.state?.waiting) {
                        const reason = cs.state.waiting.reason;
                        const message = cs.state.waiting.message;

                        inCrashLoopBackOff = inCrashLoopBackOff || reason === 'CrashLoopBackOff';

                        const msg = `${reason}: ${message ? message.trim() : 'No valuable message'}`;
                        // Skip duplicated messages
                        if (messages.length < 3 && !(messages.find((m) => m.startsWith(`${reason}:`)))) {
                            messages.push(msg);
                        }
                    }
                });
            }
        });

        return {
            inCrashLoopBackOff,
            messages
        }
    }

    private collectDeploymentErrors(deployment): string[] {
        const messages: string[] = [];
        deployment.status.conditions?.filter((c) => c.status === 'False')
            .forEach((c) => {
                const message = `${c.reason}: ${c.message ? c.message.trim() : 'No valuable message'}`;

                // Skip duplicated messages
                if (messages.length < 3 && !(messages.find((m) => m.startsWith(`${c.reason}:`)))) {
                    messages.push(message);
                }
            });

        return messages;
    }

    private async getDeploymentItem(element): Promise<TreeItem> {
        const shouldHaveReplicas = element.spec.replicas > 0;
        const desiredReplicas = element.spec.replicas ? element.spec.replicas : 0;
        const actualReplicas = element.status.replicas ? element.status.replicas : 0;
        const readyReplicas = element.status.readyReplicas ? element.status.readyReplicas : 0;
        const availableReplicas = element.status.availableReplicas ? element.status.availableReplicas : 0;
        const unavailableReplicas = element.status.unavailableReplicas ? element.status.unavailableReplicas : 0;

        let pods: OtherObject[] = [];
        if (shouldHaveReplicas) {
            try {
                pods = await this.getPods(element) as OtherObject[];
            } catch {
                // ignore
            }
        }

        // Look into Pod containers' states for any 'CrashLoopBackOff` status
        const podErrors = this.detectCrashLoopBackOff(pods);
        let podsMessages = '';
        podErrors.messages.forEach((m) => podsMessages = podsMessages.concat(`\n\t${m}`));

        // We get Deployment's 'CrashLoopBackOff` status and error messages
        const deploymentErrors = this.collectDeploymentErrors(element);

        let errorMessages = '';
        deploymentErrors.forEach((m) => errorMessages = errorMessages.concat(`\n\t${m}`));

        // const inCrashLoopBackOff = element.status.conditions.find((condition) => condition.status === 'False' && condition.reason === 'CrashLoopBackOff');
        let description = `${this.makeCaps(element.kind)}`;
        let tooltip = description;
        if (element.kind === 'Deployment') {
            description = `${description} (${availableReplicas}/${desiredReplicas})`
            tooltip = `${tooltip}: ${element.metadata.name}\n`.concat(
                `Desired Replicas: ${desiredReplicas}\n`,
                `Actual Replicas: ${actualReplicas}\n`,
                'Of which:\n',
                `\tReady Replicas: ${readyReplicas}\n`,
                `\tAvailable Replicas: ${availableReplicas}\n`,
                `\tUnavailable Replicas: ${unavailableReplicas}\n`,
                `---\nCrashLoopBackOff detected: ${podErrors.inCrashLoopBackOff ? 'Yes' : 'No'}\n`,
                podsMessages.length > 0 ? `---\nPod Container Failures:${podsMessages}\n` : '',
                errorMessages.length > 0 ? `---\nDeployment Failures:${errorMessages}\n` : ''
            );
        }
        const iconSuffix = !shouldHaveReplicas ? '' :
            podErrors.inCrashLoopBackOff ? '-red' : this.getDeploymentIconSuffix(pods);
        const iconPath = element.kind === 'Deployment' || element.kind === 'DeploymentConfig' ?
            imagePath(`context/component-node${iconSuffix}.png`) : undefined;

        const routeURL = await Oc.Instance.getRouteURL(element.metadata.name);
        return {
            contextValue: `openshift.k8sObject.${element.kind}${routeURL ? '.route' : ''}`,
            label: element.metadata.name,
            description,
            tooltip,
            collapsibleState: element.kind === 'Deployment' ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None,
            iconPath,
            command: {
                title: 'Load',
                command: 'openshift.resource.load',
                arguments: [element]
            }
        };
    }

    private makeCaps(kind: string): string {
        return kind.replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
    }

    // eslint-disable-next-line class-methods-use-this
    async getChildren(element?: ExplorerItem): Promise<ExplorerItem[]> {
        let result: ExplorerItem[] = [];
        // don't show Open In Developer Dashboard if not openshift cluster
        const isOpenshiftCluster = await isOpenShiftCluster(this.executionContext);
        if (!element) {
            try {
                if (!await LoginUtil.Instance.requireLogin()) {
                    result = [this.kubeContext];
                    if (this.kubeContext) {
                        const config = getKubeConfigFiles();
                        void commands.executeCommand('setContext', 'canCreateNamespace', await Oc.Instance.canCreateNamespace());
                        void commands.executeCommand('setContext', 'canListNamespaces', await Oc.Instance.canListNamespaces());
                        result.unshift({ label: process.env.KUBECONFIG ? 'Custom KubeConfig' : 'Default KubeConfig', description: config.join(':') })
                    }
                }
            } catch {
                // ignore because ether server is not accessible or user is logged out
            }
            OpenShiftExplorer.getInstance().onDidChangeContextEmitter.fire(this.kubeConfigInfo.getEffectiveKubeConfig().currentContext);
        } else if ('name' in element) { // we are dealing with context here
            // user is logged into cluster from current context
            // and project should be shown as child node of current context
            // there are several possible scenarios
            // (1) there is no namespace set in context and default namespace/project exists
            //   * example is kubernetes provisioned with docker-desktop
            //   * could also be the case with CRC provisioned for the first time
            // (2) there is no namespace set in context and default namespace/project does not exist
            //   * example is sandbox context created when login to sandbox first time
            // (3) there is namespace set in context and namespace exists in the cluster
            // (4) there is namespace set in context and namespace does not exist in the cluster
            const namespaces = await Oc.Instance.getProjects(false, this.executionContext);
            // Actually 'Oc.Instance.getProjects()' takes care of setting up at least one project as
            // an active project, so here after it's enough just to search the array for it.
            // The only case where there could be no active project set is empty projects array.
            let active = namespaces.find((project) => project.active);
            if (!active) active = namespaces.find(item => item?.name === 'default');

            // find active or default namespace
            if (active) {
                result = [{
                    kind: 'project',
                    metadata: {
                        name: active.name,
                    },
                } as KubernetesObject]
            } else {
                const projectName = this.kubeConfigInfo.extractProjectNameFromCurrentContext() || 'default';
                result = [await createOrSetProjectItem(projectName, this.executionContext)];
            }

            // The 'Create Service' menu visibility
            let serviceKinds: CustomResourceDefinitionStub[] = [];
            try {
                if (await Oc.Instance.canGetKubernetesObjects('csv', this.executionContext)) {
                    serviceKinds = await getServiceKindStubs(this.executionContext);
                }
            } catch {
                // operator framework is not installed on cluster; do nothing
            }
            void commands.executeCommand('setContext', 'showCreateService', serviceKinds.length > 0);

            // The 'Create Route' menu visibility
            let services: K8sResourceKind[] = [];
            try {
                services = await getServices(this.executionContext);
            }
            catch {
                // operator framework is not installed on cluster; do nothing
            }
            void commands.executeCommand('setContext', 'showCreateRoute', services.length > 0);
        } else if ('kind' in element && element.kind === 'helmContexts') {
            const helmRepos = {
                kind: 'helmRepos',
                metadata: {
                    name: 'Repositories'
                },
            } as OpenShiftObject
            const helmReleases = {
                kind: 'helmReleases',
                metadata: {
                    name: 'Releases'
                },
            } as OpenShiftObject
            result.push(helmRepos, helmReleases);
        } else if ('kind' in element && element.kind === 'helmRepos') {
            const cliData = await Helm.getHelmRepos();
            if (!cliData.error && !cliData.stderr) {
                const helmRepos = JSON.parse(cliData.stdout) as HelmRepo[];
                if (helmRepos?.length > 0) {
                    result = [...helmRepos.sort(Helm.ascRepoName)];
                }
            }
        } else if ('kind' in element && element.kind === 'Deployment') {
            try {
                return this.getPods(element);
            } catch {
                return [ couldNotGetItem(element.kind, this.kubeConfigInfo.getEffectiveKubeConfig().getCluster(this.kubeContext.cluster)?.server) ];
            }
        } else if ('kind' in element && element.kind === 'project') {
            const deployments = {
                kind: 'deployments',
                metadata: {
                    name: 'deployments'
                },
            } as OpenShiftObject;
            const helmContexts = {
                kind: 'helmContexts',
                metadata: {
                    name: 'helmContexts'
                },
            } as OpenShiftObject
            const workLoads = {
                kind: 'workloads',
                metadata: {
                    name: 'workloads'
                },
            } as OpenShiftObject
            result.push(deployments, helmContexts, workLoads);
        } else if ('kind' in element && element.kind === 'workloads') {
            const pods = {
                kind: 'pods',
                metadata: {
                    name: 'pods'
                },
            } as OpenShiftObject;
            const routes = {
                kind: 'routes',
                metadata: {
                    name: 'routes'
                },
            } as OpenShiftObject;
            const pipelines = {
                kind: 'pipelines',
                metadata: {
                    name: 'pipelines'
                },
            } as OpenShiftObject;
            const statefulSets = {
                kind: 'statefulsets',
                metadata: {
                    name: 'stateful sets'
                },
            } as OpenShiftObject;
            const daemonSets = {
                kind: 'daemonSets',
                metadata: {
                    name: 'daemon sets'
                },
            } as OpenShiftObject;
            const jobs = {
                kind: 'jobs',
                metadata: {
                    name: 'jobs'
                },
            } as OpenShiftObject;
            const cronJobs = {
                kind: 'cronjobs',
                metadata: {
                    name: 'cron jobs'
                },
            } as OpenShiftObject;
            const deploymentConfigs = {
                kind: 'deploymentconfigs',
                metadata: {
                    name: 'deployment configs'
                },
            } as OpenShiftObject;
            const imageStreams = {
                kind: 'imagestreams',
                metadata: {
                    name: 'image streams'
                },
            } as OpenShiftObject;
            const buildConfigs = {
                kind: 'buildConfigs',
                metadata: {
                    name: 'build configs'
                },
            } as OpenShiftObject;
            result.push(pods,
                statefulSets, daemonSets, jobs, cronJobs);
            if (isOpenshiftCluster) {
                result.push(deploymentConfigs, imageStreams, buildConfigs, routes, pipelines);
            }
        } else if ('kind' in element) {
            const collectableServices: CustomResourceDefinitionStub[] = await this.getServiceKinds();
            let collections: KubernetesObject[] | Helm.HelmRelease[] | ExplorerItem[] | PipelineTasks[];
            switch (element.kind) {
                case 'helmReleases':
                    collections = await Helm.getHelmReleases();
                    if (collections.length === 0) {
                        collections = [{
                            chart: 'noChart'
                        }]
                    }
                    break;
                    case 'pipelines':
                    collections =  await this.getPipelineTasks(element);
                    break;
                default:
                    try {
                        collections = await Oc.Instance.getKubernetesObjects(element.kind, undefined, undefined, this.executionContext);
                    } catch {
                        collections = [ couldNotGetItem(element.kind, this.kubeConfigInfo.getEffectiveKubeConfig().getCluster(this.kubeContext.cluster)?.server) ];
                    }
                    break;
            }
            const toCollect = [
                collections,
                ...collectableServices
                    .map(serviceKind => Oc.Instance.getKubernetesObjects(serviceKind.name, undefined, undefined, this.executionContext))
            ];
            result = await Promise.all(toCollect).then(listOfLists => listOfLists.flatMap(a => a as ExplorerItem[]));
        }
        if (!element) {
            await commands.executeCommand('setContext', 'openshift.app.explorer.init', result.length === 0);
        } else {
            void commands.executeCommand('setContext', 'isOpenshiftCluster', isOpenshiftCluster);
        }
        return result;
    }

    private async getServiceKinds() {
        let serviceKinds: CustomResourceDefinitionStub[] = [];
        try {
            if (await Oc.Instance.canGetKubernetesObjects('csv', this.executionContext)) {
                serviceKinds = await getServiceKindStubs(this.executionContext);
            }
        } catch {
            // operator framework is not installed on cluster; do nothing
        }

        const collectableServices: CustomResourceDefinitionStub[] = [];
        await Promise.all(serviceKinds.map(async (serviceKind) => {
            if (await Oc.Instance.canGetKubernetesObjects(serviceKind.name, this.executionContext)) {
                collectableServices.push(serviceKind);
            }
        }));
        return collectableServices;
    }

    public async getPods(element: KubernetesObject | OpenShiftObject) {
        return await Oc.Instance.getKubernetesObjects('pods', undefined, element.metadata.name, this.executionContext);
    }

    public async getPipelineTasks(element: KubernetesObject | OpenShiftObject): Promise<PipelineTasks[]> {
        const namespace: string = await Oc.Instance.getActiveProject();
        const collections = await Oc.Instance.getKubernetesObjects(element.kind, namespace, undefined, this.executionContext) as OtherObject[];
        const taskNames: PipelineTasks[] = [];
        if (!collections || collections.length === 0 || !collections[0].spec) {
            return [];
        }
        const tasks = collections[0].spec.tasks;
        tasks?.map((task) => {
            taskNames.push({ name : task.name, context: 'pipelineTask' });
        })
        return taskNames;
    }

    refresh(target?: ExplorerItem): void {
        // Create new Execution Context before refreshing
        if (this.executionContext) {
            this.executionContext.clear();
        }
        this.executionContext = new ExecutionContext();

        this.eventEmitter.fire(target);
    }

    dispose(): void {
        for (const fsw of this.kubeConfigWatchers) {
            fsw?.watcher?.close();
        }
        this.treeView.dispose();
    }

    @vsCommand('openshift.resource.load')
    public static async loadResource(component: KubernetesObject) {
        if (component) {
            if ('chart' in component && 'name' in component && 'revision' in component
                && 'status' in component && component.chart !== 'noChart'
                && component.status === 'deployed') { // Deployed Helm Chart
                const releaseName: string = typeof component.name === 'string' ? component.name : '';
                const revisionString: string | undefined = typeof component.revision === 'string' ? component.revision : undefined;
                const revision = revisionString ? parseInt(revisionString, 10) : undefined;
                void OpenShiftExplorer.getInstance().loadKubernetesHelmChart(releaseName, revision);
            } else {
                if (component.kind === 'Pod') {
                    const contextElement: OtherObject = component;
                    const pods = await OpenShiftExplorer.getInstance().getPods(contextElement);
                    if (pods.length === 0) {
                        contextElement.status.phase = 'Terminated'
                        void OpenShiftExplorer.getInstance().refresh(contextElement);
                        void window.showInformationMessage(`Pod ${(contextElement as KubernetesObject).metadata?.name} ${contextElement.status.phase.toLowerCase()}`);
                        void OpenShiftExplorer.getInstance().refresh();
                        return;
                    }
                }
                void OpenShiftExplorer.getInstance().loadKubernetesCore(component.metadata.namespace, `${component.kind}/${component.metadata.name}`);
            }
        }
    }

    /**
     * Loading deployment config
     * @param namespace namespace
     * @param value deployment name
     */
    loadKubernetesCore(namespace: string | null, value: string) {
        const outputFormat = getOutputFormat();
        // Names are to be only lowercase,
        // see: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#dns-subdomain-names
        const uri = kubefsUri(namespace, value.toLocaleLowerCase(), outputFormat, undefined, true);
        this.loadKubernetesDocument(uri);
    }

    /**
     * Loading an installed Helm Chart config
     * @param releaseName Installed Helm Chart release name
     * @param revision Installed Helm Chart revision
     */
    loadKubernetesHelmChart(releaseName: string, revision: number | undefined) {
        const uri = helmfsUri(releaseName, revision, true);
        this.loadKubernetesDocument(uri);
    }

    /**
     * Loading a Kubernates document by its Uri
     * @param uri A Kubernetes document Uri
     */
    loadKubernetesDocument(uri: Uri) {
        workspace.openTextDocument(uri).then(
            (doc) => {
                if (doc) {
                    void window.showTextDocument(doc);
                }
            },
            (err) => window.showErrorMessage(`Error loading document: ${err}`));
    }

    @vsCommand('openshift.resource.delete')
    public static async deleteResource(component: KubernetesObject) {
        await Progress.execFunctionWithProgress(`Deleting '${component.kind}/${component.metadata.name}'`, async (_) => {
            await Oc.Instance.deleteKubernetesObject(component.kind, component.metadata.name);
        });
        void window.showInformationMessage(`Deleted the '${component.kind}' named '${component.metadata.name}'`);
        OpenShiftExplorer.getInstance().refresh();
    }

    @vsCommand('openshift.resource.portForward')
    public static async portForward(component: KubernetesObject) {
        const kind = component.kind || 'pods';
        const resourceName = component.metadata.name;
        const namespace: string = await Oc.Instance.getActiveProject();
        return await PortForward.getInstance().promptAndForwardPort(kind, resourceName, namespace);
    }

    @vsCommand('openshift.resource.watchLogs')
    public static async watchLogs(component: KubernetesObject) {
        const namespace: string = await Oc.Instance.getActiveProject();
        // wait until logs are available before starting to stream them
        await Progress.execFunctionWithProgress(`Opening ${component.kind}/${component.metadata.name} logs...`, (_) => {
            return new Promise<void>(resolve => {

                let intervalId: ReturnType<typeof setInterval> | undefined = undefined;

                function checkForPod() {
                    void Oc.Instance.getLogs(`${component.kind}`, component.metadata.name, namespace).then((logs) => {
                        clearInterval(intervalId);
                        resolve();
                    }).catch(_e => { });
                }

                intervalId = setInterval(checkForPod, 200);
            });
        });

        void OpenShiftTerminalManager.getInstance().createTerminal(
            new CommandText('oc', `logs -f ${component.kind}/${component.metadata.name}`,
                [new CommandOption('--namespace', namespace)]),
            `Watching '${component.metadata.name}' logs`);
    }

    @vsCommand('openshift.resource.unInstall')
    public static async unInstallHelmChart(release: Helm.HelmRelease) {
        return Progress.execFunctionWithProgress(`Uninstalling ${release.name}`, async () => {
            await Helm.unInstallHelmChart(release.name);
            OpenShiftExplorer.getInstance().refresh();
        });
    }

    @vsCommand('openshift.resource.openInConsole')
    public static openInConsole(component: KubernetesObject) {
        void commands.executeCommand('openshift.resource.load', { namespace: component.metadata.namespace, kindName: `${component.kind}/${component.metadata.name}` });
    }

    @vsCommand('openshift.explorer.reportIssue')
    static async reportIssue(): Promise<unknown> {
        const extensionPath = path.resolve(__dirname, '..', '..');
        const templatePath = path.join(extensionPath, 'resources', 'issueReport.md');
        const template = fs.readFileSync(templatePath, 'utf-8');
        return commands.executeCommand('workbench.action.openIssueReporter', {
            extensionId: 'redhat.vscode-openshift-connector',
            issueBody: template
        });
    }

    @vsCommand('openshift.open.configFile')
    async openConfigFile(context: TreeItem): Promise<void> {
        if (context.description && typeof context.description === 'string') {
            await commands.executeCommand('vscode.open', Uri.file(context.description));
        }
    }

    static issueUrl(): string {
        const packageJSON: PackageJSON = extensions.getExtension('redhat.vscode-openshift-connector')
            .packageJSON as PackageJSON;
        const body = [
            `VS Code version: ${version}`,
            `OS: ${Platform.OS}`,
            `Extension version: ${packageJSON.version}`,
        ].join('\n');
        return `${packageJSON.bugs}/new?labels=kind/bug&title=&body=**Environment**\n${body}\n**Description**`;
    }

    @vsCommand('openshift.explorer.describe.kubeconfig', true)
    static async describeEffectiveConfig(): Promise<void> {
        const k8sConfig: string = new KubeConfigInfo().dumpEffectiveKubeConfig();
        const tempK8sConfigFile = await new Promise<string>((resolve, reject) => {
            tmp.file({ prefix: 'effective.config' ,postfix: '.yaml' }, (err, name) => {
                if (err) {
                    reject(err);
                }
                resolve(name);
            });
        });
        fs.writeFileSync(tempK8sConfigFile, k8sConfig, 'utf-8')
        fs.chmodSync(tempK8sConfigFile, 0o400);
        const fileUri = Uri.parse(tempK8sConfigFile);
        window.showTextDocument(fileUri, { preview: true, readOnly: true } as TextDocumentShowOptions);
        const onCloseSubscription = workspace.onDidCloseTextDocument((closedDoc) => {
            if (closedDoc.uri.toString() === fileUri.toString()) {
                fs.chmodSync(tempK8sConfigFile, 0o600);
                fs.unlinkSync(tempK8sConfigFile);
                onCloseSubscription.dispose();
            }
        });
    }
}
