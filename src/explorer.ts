/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Context, KubernetesObject } from '@kubernetes/client-node';
import * as fs from 'fs';
import * as path from 'path';
import {
    Disposable,
    Event,
    EventEmitter,
    ThemeIcon,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    TreeView,
    Uri,
    commands,
    extensions,
    version,
    window,
    workspace
} from 'vscode';
import { CommandText } from './base/command';
import * as Helm from './helm/helm';
import { HelmRepo } from './helm/helmChartType';
import { Oc } from './oc/ocWrapper';
import { Component } from './openshift/component';
import { getServiceKindStubs, getServices } from './openshift/serviceHelpers';
import { KubeConfigUtils, getKubeConfigFiles, getNamespaceKind } from './util/kubeUtils';
import { Platform } from './util/platform';
import { Progress } from './util/progress';
import { FileContentChangeNotifier, WatchUtil } from './util/watch';
import { vsCommand } from './vscommand';
import { CustomResourceDefinitionStub, K8sResourceKind } from './webview/common/createServiceTypes';
import { OpenShiftTerminalManager } from './webview/openshift-terminal/openShiftTerminal';
import { LoginUtil } from './util/loginUtil';

type ExplorerItem = KubernetesObject | Helm.HelmRelease | Context | TreeItem | OpenShiftObject | HelmRepo;

export type OpenShiftObject = {
    kind: string,
    metadata: {
        name: string
    },
}

export interface DeploymentPodObject extends KubernetesObject {
    spec?: {
        [key: string]: string
    },
    status?: {
        [key: string]: string
    },
}

type PackageJSON = {
    version: string;
    bugs: string;
};

async function createOrSetProjectItem(projectName: string): Promise<ExplorerItem> {
    const kind = await getNamespaceKind();
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

export class OpenShiftExplorer implements TreeDataProvider<ExplorerItem>, Disposable {
    private static instance: OpenShiftExplorer;

    private treeView: TreeView<ExplorerItem>;

    private kubeConfigWatchers: FileContentChangeNotifier[];
    private kubeContext: Context;
    private kubeConfig: KubeConfigUtils;

    private eventEmitter: EventEmitter<ExplorerItem | undefined> =
        new EventEmitter<ExplorerItem | undefined>();

    readonly onDidChangeTreeData: Event<ExplorerItem | undefined> = this
        .eventEmitter.event;

    public onDidChangeContextEmitter = new EventEmitter<string>();

    private constructor() {
        try {
            this.kubeConfig = new KubeConfigUtils();
            this.kubeContext = this.kubeConfig.getContextObject(this.kubeConfig.currentContext);
        } catch (err) {
            // ignore config loading error and let odo report it on first call
        }
        try {
            const kubeconfigFiles = getKubeConfigFiles();
            this.kubeConfigWatchers = kubeconfigFiles.map(kubeconfigFile => WatchUtil.watchFileForContextChange(path.dirname(kubeconfigFile), path.basename(kubeconfigFile)));
        } catch (err) {
            void window.showWarningMessage('Couldn\'t install watcher for Kubernetes configuration file. OpenShift Application Explorer view won\'t be updated automatically.');
        }
        for (const fsw of this.kubeConfigWatchers) {
            fsw.emitter?.on('file-changed', () => {
                const ku2 = new KubeConfigUtils();
                const newCtx = ku2.getContextObject(ku2.currentContext);
                if (Boolean(this.kubeContext) !== Boolean(newCtx)
                    || (this.kubeContext.cluster !== newCtx.cluster
                        || this.kubeContext.user !== newCtx.user
                        || this.kubeContext.namespace !== newCtx.namespace)) {
                    this.refresh();
                    this.onDidChangeContextEmitter.fire(newCtx?.name); // newCtx can be 'null'
                }
                this.kubeContext = newCtx;
                this.kubeConfig = ku2;
            });
        }
        this.treeView = window.createTreeView<ExplorerItem>('openshiftProjectExplorer', {
            treeDataProvider: this,
        });
        Component.onDidStateChanged((_context) => {
            this.refresh();
        });
    }

    static getInstance(): OpenShiftExplorer {
        if (!OpenShiftExplorer.instance) {
            OpenShiftExplorer.instance = new OpenShiftExplorer();
        }
        return OpenShiftExplorer.instance;
    }

    private static generateOpenshiftProjectContextValue(namespace: string): Thenable<string> {
        const contextValue = `openshift.project.${namespace}`;
        return Oc.Instance.canDeleteNamespace(namespace)
            .then(result => (result ? `${contextValue}.can-delete` : contextValue));
    }

    // eslint-disable-next-line class-methods-use-this
    async getTreeItem(element: ExplorerItem): Promise<TreeItem> {

        if ('command' in element) {
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
                label: this.kubeConfig.getCluster(element.cluster).server,
                collapsibleState: TreeItemCollapsibleState.Collapsed,
                iconPath: path.resolve(__dirname, '../../images/context/cluster-node.png')
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
                iconPath: element.status === 'failed' ? path.resolve(__dirname, '../../images/context/helmFailed.svg') :
                    path.resolve(__dirname, '../../images/context/helmDeployed.svg'),
                tooltip: `Chart version: ${element.chart}\nApp version: ${element.app_version}\n`,
            };
        }

        // otherwise it is a KubernetesObject instance
        if ('kind' in element) {
            if (element.kind === 'project') {
                return OpenShiftExplorer.generateOpenshiftProjectContextValue(element.metadata.name)
                    .then(namespace => {
                        return {
                            contextValue: namespace,
                            label: element.metadata.name,
                            collapsibleState: TreeItemCollapsibleState.Collapsed,
                            iconPath: path.resolve(__dirname, '../../images/context/project-node.png')
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
            } else if (element.kind === 'Pod') {
                const contextElement: DeploymentPodObject = element;
                return {
                    contextValue: 'openshift.k8sObject.pod',
                    label: contextElement.metadata.name,
                    description: `${contextElement.kind.substring(0, 1).toLocaleUpperCase()}${contextElement.kind.substring(1)}`,
                    collapsibleState: TreeItemCollapsibleState.None,
                    iconPath: contextElement.status.phase === 'Running' ? path.resolve(__dirname, '../../images/context/runningPod.svg') :
                        path.resolve(__dirname, '../../images/context/notReadyPod.svg'),
                    tooltip: `${contextElement.status.phase}\n${contextElement.status.podIP ? contextElement.status.podIP : ''}`,
                    command: {
                        title: 'Load',
                        command: 'openshift.resource.load',
                        arguments: contextElement.status.phase === 'Running' ? [contextElement] : undefined
                    }
                }
            }
            const contextElement: DeploymentPodObject = element;
            if (!contextElement.spec) {
                const elementValue = this.makeCaps(element.metadata.name);
                return {
                    contextValue: `openshift.k8sobject.${element.kind}`,
                    label: elementValue,
                    collapsibleState: TreeItemCollapsibleState.Collapsed
                }
            }
            const routeURL = await Oc.Instance.getRouteURL(element.metadata.name);
            return {
                contextValue: `openshift.k8sObject.${element.kind}${routeURL ? '.route' : ''}`,
                label: element.metadata.name,
                description: `${element.kind.substring(0, 1).toLocaleUpperCase()}${element.kind.substring(1)}`,
                collapsibleState: element.kind === 'Deployment' ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None,
                iconPath: element.kind === 'Deployment' || element.kind === 'DeploymentConfig' ? path.resolve(__dirname, '../../images/context/component-node.png') : undefined,
                command: {
                    title: 'Load',
                    command: 'openshift.resource.load',
                    arguments: [element]
                }
            };

        }
        return {
            label: 'Unknown element'
        }
    }

    private makeCaps(kind: string): string {
        return kind.replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
    }

    // eslint-disable-next-line class-methods-use-this
    async getChildren(element?: ExplorerItem): Promise<ExplorerItem[]> {
        let result: ExplorerItem[] = [];
        // don't show Open In Developer Dashboard if not openshift cluster
        const isOpenshiftCluster = await Oc.Instance.isOpenShiftCluster();
        if (!element) {
            try {
                if (!await LoginUtil.Instance.requireLogin()) {
                    result = [this.kubeContext];
                    if (this.kubeContext) {
                        const config = getKubeConfigFiles();
                        void commands.executeCommand('setContext', 'canCreateNamespace', await Oc.Instance.canCreateNamespace());
                        result.unshift({ label: process.env.KUBECONFIG ? 'Custom KubeConfig' : 'Default KubeConfig', description: config.join(':') })
                    }
                }
            } catch (err) {
                // ignore because ether server is not accessible or user is logged out
            }
            OpenShiftExplorer.getInstance().onDidChangeContextEmitter.fire(new KubeConfigUtils().currentContext);
        } else if ('name' in element) { // we are dealing with context here
            // user is logged into cluster from current context
            // and project should be show as child node of current context
            // there are several possible scenarios
            // (1) there is no namespace set in context and default namespace/project exists
            //   * example is kubernetes provisioned with docker-desktop
            //   * could also be the case with CRC provisioned for the first time
            // (2) there is no namespace set in context and default namespace/project does not exist
            //   * example is sandbox context created when login to sandbox first time
            // (3) there is namespace set in context and namespace exists in the cluster
            // (4) there is namespace set in context and namespace does not exist in the cluster
            const namespaces = await Oc.Instance.getProjects();
            if (this.kubeContext.namespace) {
                if (namespaces.find(item => item.name === this.kubeContext.namespace)) {
                    result = [{
                        kind: 'project',
                        metadata: {
                            name: this.kubeContext.namespace,
                        },
                    } as KubernetesObject];
                } else {
                    result = [await createOrSetProjectItem(this.kubeContext.namespace)];
                }
            } else {
                // get list of projects or namespaces
                // find default namespace
                if (namespaces.find(item => item?.name === 'default')) {
                    result = [{
                        kind: 'project',
                        metadata: {
                            name: 'default',
                        },
                    } as KubernetesObject]
                } else {
                    const projectName = this.kubeConfig.extractProjectNameFromCurrentContext() || 'default';
                    result = [await createOrSetProjectItem(projectName)];
                }
            }

            // The 'Create Service' menu visibility
            let serviceKinds: CustomResourceDefinitionStub[] = [];
            try {
                if (await Oc.Instance.canGetKubernetesObjects('csv')) {
                    serviceKinds = await getServiceKindStubs();
                }
            } catch (_) {
                // operator framework is not installed on cluster; do nothing
            }
            void commands.executeCommand('setContext', 'showCreateService', serviceKinds.length > 0);

            // The 'Create Route' menu visibility
            let services: K8sResourceKind[] = [];
            try {
                services = await getServices();
            }
            catch (_) {
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
            return await this.getPods(element);
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
                result.push(deploymentConfigs, imageStreams, buildConfigs);
            }
        } else if ('kind' in element) {
            const collectableServices: CustomResourceDefinitionStub[] = await this.getServiceKinds();
            let collections: KubernetesObject[] | Helm.HelmRelease[];
            switch (element.kind) {
                case 'helmReleases':
                    collections = await Helm.getHelmReleases();
                    if (collections.length === 0) {
                        collections = [{
                            chart: 'noChart'
                        }]
                    }
                    break;
                default:
                    collections = await Oc.Instance.getKubernetesObjects(element.kind);
                    break;
            }
            const toCollect = [
                collections,
                ...collectableServices
                    .map(serviceKind => Oc.Instance.getKubernetesObjects(serviceKind.name))
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
            if (await Oc.Instance.canGetKubernetesObjects('csv')) {
                serviceKinds = await getServiceKindStubs();
            }
        } catch (_) {
            // operator framework is not installed on cluster; do nothing
        }

        const collectableServices: CustomResourceDefinitionStub[] = [];
        await Promise.all(serviceKinds.map(async (serviceKind) => {
            if (await Oc.Instance.canGetKubernetesObjects(serviceKind.name)) {
                collectableServices.push(serviceKind);
            }
        }));
        return collectableServices;
    }

    public async getPods(element: KubernetesObject | OpenShiftObject) {
        const pods = await Oc.Instance.getKubernetesObjects('pods');
        return pods.filter((pod) => pod.metadata.name.indexOf(element.metadata.name) !== -1);
    }

    refresh(target?: ExplorerItem): void {
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
            if (component.kind === 'Pod') {
                const contextElement: DeploymentPodObject = component;
                const pods = await OpenShiftExplorer.getInstance().getPods(contextElement);
                if (pods.length === 0) {
                    contextElement.status.phase = 'Terminated'
                    void OpenShiftExplorer.getInstance().refresh(contextElement);
                    void window.showInformationMessage(`Pod ${contextElement.metadata.name} ${contextElement.status.phase.toLowerCase()}`);
                    void OpenShiftExplorer.getInstance().refresh();
                    return;
                }
            }
            void OpenShiftExplorer.getInstance().loadKubernetesCore(component.metadata.namespace, `${component.kind}/${component.metadata.name}`);
        }
    }

    /**
     * loadind deployment config
     * @param namespace namespace
     * @param value deployment name
     */
    loadKubernetesCore(namespace: string | null, value: string) {
        const outputFormat = this.getOutputFormat();
        const uri = this.kubefsUri(namespace, value, outputFormat);

        const query = this.getComparableQuery(uri);
        const openUri = workspace.textDocuments.map((doc) => doc.uri)
            .find((docUri) => {
                return (docUri.scheme === uri.scheme &&
                    docUri.authority === uri.authority &&
                    docUri.fragment === uri.fragment &&
                    docUri.path === uri.path &&
                    this.getComparableQuery(docUri) === query);
            });

        // If open document is found for the URI provided, we use its URI to bring its editor to the front
        // instead of openning a new editor
        workspace.openTextDocument(openUri ? openUri : uri).then((doc) => {
            if (doc) {
                void window.showTextDocument(doc);
            }
        },
            (err) => window.showErrorMessage(`Error loading document: ${err}`));
    }

    /**
     * get output format from vs-kubernetes.outputFormat
     * default yaml
     *
     * @returns output format
     */
    getOutputFormat(): string {
        if (workspace.getConfiguration('vs-kubernetes').has('vs-kubernetes.outputFormat')) {
            return workspace.getConfiguration('vs-kubernetes').get['vs-kubernetes.outputFormat'] as string;
        }
        return 'yaml'
    }

    kubefsUri(namespace: string | null | undefined, value: string, outputFormat: string, action?: string): Uri {
        const K8S_RESOURCE_SCHEME = 'k8smsx';
        const K8S_RESOURCE_SCHEME_READONLY = 'k8smsxro';
        const KUBECTL_RESOURCE_AUTHORITY = 'loadkubernetescore';
        const KUBECTL_DESCRIBE_AUTHORITY = 'kubernetesdescribe';
        const docname = `${value.replace('/', '-')}${outputFormat && outputFormat !== '' ? `.${outputFormat}` : ''}`;
        const nonce = new Date().getTime();
        const nsquery = namespace ? `ns=${namespace}&` : '';
        const scheme = action === 'describe' ? K8S_RESOURCE_SCHEME_READONLY : K8S_RESOURCE_SCHEME;
        const authority = action === 'describe' ? KUBECTL_DESCRIBE_AUTHORITY : KUBECTL_RESOURCE_AUTHORITY;
        const uri = `${scheme}://${authority}/${docname}?${nsquery}value=${value}&_=${nonce}`;
        return Uri.parse(uri);
    }

    /*
     * Returns the query string of the specified Uri without "nonce" param,
     * so the query strings can be compared.
     * The "nonce" param is generated as current time value for every KubefsUri created,
     * f.i., "_=1709642987392", and are always added to the end of the query string (so
     * they always have the preceeding query parameters sepacator character ("&") added),
     * so the query strings, if they aren't cleared from "nonce" param, can be compared for
     * Uri objects even when they point to the same document.
     */
    getComparableQuery(uri: Uri): string {
        return uri.query.replace(/&_=[0-9]+/g, '');
    }

    @vsCommand('openshift.resource.delete')
    public static async deleteResource(component: KubernetesObject) {
        await Progress.execFunctionWithProgress(`Deleting '${component.kind}/${component.metadata.name}'`, async (_) => {
            await Oc.Instance.deleteKubernetesObject(component.kind, component.metadata.name);
        });
        void window.showInformationMessage(`Deleted the '${component.kind}' named '${component.metadata.name}'`);
        OpenShiftExplorer.instance.refresh();
    }

    @vsCommand('openshift.resource.watchLogs')
    public static async watchLogs(component: KubernetesObject) {
        // wait until logs are available before starting to stream them
        await Progress.execFunctionWithProgress(`Opening ${component.kind}/${component.metadata.name} logs...`, (_) => {
            return new Promise<void>(resolve => {

                let intervalId: NodeJS.Timer = undefined;

                function checkForPod() {
                    void Oc.Instance.getLogs('Deployment', component.metadata.name).then((logs) => {
                        clearInterval(intervalId);
                        resolve();
                    }).catch(_e => { });
                }

                intervalId = setInterval(checkForPod, 200);
            });
        });

        void OpenShiftTerminalManager.getInstance().createTerminal(new CommandText('oc', `logs -f ${component.kind}/${component.metadata.name}`), `Watching '${component.metadata.name}' logs`);
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
        void commands.executeCommand('extension.vsKubernetesLoad', { namespace: component.metadata.namespace, kindName: `${component.kind}/${component.metadata.name}` });
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
}
