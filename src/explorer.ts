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
    window
} from 'vscode';
import * as Helm from './helm/helm';
import { Oc } from './oc/ocWrapper';
import { Odo } from './odo/odoWrapper';
import { getServiceKindStubs } from './openshift/serviceHelpers';
import { KubeConfigUtils, getKubeConfigFiles } from './util/kubeUtils';
import { Platform } from './util/platform';
import { Progress } from './util/progress';
import { FileContentChangeNotifier, WatchUtil } from './util/watch';
import { vsCommand } from './vscommand';
import { CustomResourceDefinitionStub } from './webview/common/createServiceTypes';
import { HelmRepo } from './webview/helm-chart/helmChartType';

type ExplorerItem = KubernetesObject | Helm.HelmRelease | Context | TreeItem | OpenShiftObject | HelmRepo;

export type OpenShiftObject = {
    kind: string,
    metadata: {
        name: string
    },
}

type PackageJSON = {
    version: string;
    bugs: string;
};

const CREATE_OR_SET_PROJECT_ITEM = {
    label: 'Create new or set active Project',
    command: {
        title: 'Create new or set active Project',
        command: 'openshift.project.set'
    }
};

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
                }
                this.kubeContext = newCtx;
                this.kubeConfig = ku2;
            });
        }
        this.treeView = window.createTreeView<ExplorerItem>('openshiftProjectExplorer', {
            treeDataProvider: this,
        });
    }

    static getInstance(): OpenShiftExplorer {
        if (!OpenShiftExplorer.instance) {
            OpenShiftExplorer.instance = new OpenShiftExplorer();
        }
        return OpenShiftExplorer.instance;
    }

    // eslint-disable-next-line class-methods-use-this
    getTreeItem(element: ExplorerItem): TreeItem | Thenable<TreeItem> {

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
            return {
                contextValue: 'openshift.k8sObject.helm',
                label: element.name,
                collapsibleState: TreeItemCollapsibleState.None,
                description: 'Helm Release',
                iconPath: path.resolve(__dirname, '../../images/context/helm.png'),
            };
        }

        // otherwise it is a KubernetesObject instance
        if ('kind' in element) {
            if (element.kind === 'project') {
                return {
                    contextValue: 'openshift.project',
                    label: element.metadata.name,
                    collapsibleState: TreeItemCollapsibleState.Collapsed,
                    iconPath: path.resolve(__dirname, '../../images/context/project-node.png')
                }
            } else if (element.kind === 'helm') {
                return {
                    contextValue: 'openshift.helm.repos',
                    label: element.metadata.name,
                    collapsibleState: TreeItemCollapsibleState.Collapsed,
                    description: 'Repositories',
                    iconPath: path.resolve(__dirname, '../../images/context/helm.png')
                }
            }
            return {
                contextValue: 'openshift.k8sObject',
                label: element.metadata.name,
                description: `${element.kind.substring(0, 1).toLocaleUpperCase()}${element.kind.substring(1)}`,
                collapsibleState: TreeItemCollapsibleState.None,
                iconPath: path.resolve(__dirname, '../../images/context/component-node.png'),
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

    // eslint-disable-next-line class-methods-use-this
    async getChildren(element?: ExplorerItem): Promise<ExplorerItem[]> {
        let result: ExplorerItem[] = [];
        if (!element) {
            try {
                await Odo.Instance.getProjects();
                result = [this.kubeContext];
                if (this.kubeContext) {
                    const config = getKubeConfigFiles();
                    const canCreateNamespace = await Oc.Instance.canCreateNamespace();
                    void commands.executeCommand('setContext', 'canCreateNamespace', canCreateNamespace);
                    result.unshift({ label: process.env.KUBECONFIG ? 'Custom KubeConfig' : 'Default KubeConfig', description: config.join(':') })
                }
            } catch (err) {
                // ignore because ether server is not accessible or user is logged out
            }
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
            const namespaces = await Odo.Instance.getProjects();
            const helmContext = {
                kind: 'helm',
                metadata: {
                    name: 'Helm'
                },
            } as OpenShiftObject
            if (this.kubeContext.namespace) {
                if (namespaces.find(item => item.name === this.kubeContext.namespace)) {
                    result = [{
                        kind: 'project',
                        metadata: {
                            name: this.kubeContext.namespace,
                        },
                    } as KubernetesObject]
                } else if (namespaces.length >= 1) {
                    // switch to first accessible namespace
                    await Odo.Instance.setProject(namespaces[0].name);
                } else {
                    result = [CREATE_OR_SET_PROJECT_ITEM]
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
                    result = [CREATE_OR_SET_PROJECT_ITEM]
                }
            }
            result.push(helmContext);
        } else if ('kind' in element && element.kind === 'helm') {
            const cliData = await Helm.getHelmRepos();
            if (!cliData.error && !cliData.stderr) {
                const helmRepos = JSON.parse(cliData.stdout) as HelmRepo[];
                if (helmRepos?.length > 0) {
                    result = [...helmRepos];
                }
            }
        } else {
            let serviceKinds: CustomResourceDefinitionStub[] = [];
            try {
                serviceKinds = await getServiceKindStubs();
            } catch (_) {
                // operator framework is not installed on cluster; do nothing
            }

            const toCollect = [
                Oc.Instance.getKubernetesObjects('Deployment'),
                Helm.getHelmReleases(),
                ...serviceKinds.map(serviceKind => Oc.Instance.getKubernetesObjects(serviceKind.name))
            ];
            if (await Oc.Instance.isOpenShiftCluster()) {
                toCollect.push(
                    Oc.Instance.getKubernetesObjects('DeploymentConfig'),
                )
            }

            result = await Promise.all(toCollect).then(listOfLists => listOfLists.flatMap(a => a as ExplorerItem[]));

        }

        // don't show Open In Developer Dashboard if not openshift cluster
        const isOpenshiftCluster = await Oc.Instance.isOpenShiftCluster();
        void commands.executeCommand('setContext', 'isOpenshiftCluster', isOpenshiftCluster);

        if (!element) {
            await commands.executeCommand('setContext', 'openshift.app.explorer.init', result.length === 0);
        }
        return result;
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
    public static loadResource(component: KubernetesObject) {
        void commands.executeCommand('extension.vsKubernetesLoad', { namespace: component.metadata.namespace, kindName: `${component.kind}/${component.metadata.name}` });
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
