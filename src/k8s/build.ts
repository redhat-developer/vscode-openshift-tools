/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { QuickPickItem, window } from "vscode";
import { OdoImpl, Odo } from "../odo";
import { Progress } from "../util/progress";
import * as vscode from 'vscode';
import { ClusterExplorerV1 } from 'vscode-kubernetes-tools-api';
import * as k8s from 'vscode-kubernetes-tools-api';

export class BuildConfigNodeContributor implements ClusterExplorerV1.NodeContributor {
    contributesChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): boolean {
        return !!parent && parent.nodeType === 'resource' && parent.resourceKind.manifestKind === 'BuildConfig';
    }

    async getChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<ClusterExplorerV1.Node[]> {
        const kubectl = await k8s.extension.kubectl.v1;
        if (kubectl.available) {
            const result = await kubectl.api.invokeCommand(`get build -o jsonpath="{range .items[?(.metadata.labels.buildconfig=='${(parent as any).name}')]}{.metadata.namespace}{','}{.metadata.name}{','}{.metadata.annotations.openshift\\.io/build\\.number}{\\"\\n\\"}{end}"`);
            const builds = result.stdout.split('\n')
                .filter((value) => value !== '')
                .map<BuildNode>((item: string) => new BuildNode(item.split(',')[0], item.split(',')[1], Number.parseInt(item.split(',')[2])));
            return builds;
        }
        return [];
    }
}

class BuildNode implements ClusterExplorerV1.Node, ClusterExplorerV1.ClusterExplorerResourceNode {
    nodeType: "resource";
    readonly resourceKind: ClusterExplorerV1.ResourceKind = {
        manifestKind: 'Build',
        abbreviation: 'build'
    };
    readonly kind: ClusterExplorerV1.ResourceKind = this.resourceKind;
    public id: string;
    public resourceId: string;
    // tslint:disable-next-line:variable-name
    constructor(readonly namespace: string, readonly name: string, readonly number: number, readonly metadata?: any) {
        this.id = this.resourceId = `build/${this.name}`;
    }

    async getChildren(): Promise<ClusterExplorerV1.Node[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const item = new vscode.TreeItem(this.name);
        item.contextValue = 'openShift.resource.build';
        item.command = {
            arguments: [this],
            command: 'extension.vsKubernetesLoad',
            title: "Load"
        };
        return item;
    }
}

export class Command {

    static startBuild(buildConfig: string) {
        return `oc start-build ${buildConfig}`;
    }

    static deploy(build: string) {
        return `oc rollout latest dc/${build}`;
    }

    static getBuilds(build: string) {
        return `oc get build -l buildconfig=${build} -o json`;
    }

    static showLog(build: string, text: string) {
        return `oc logs ${build}${text}`;
    }

    static rebuildFrom(resourceId: String) {
        return `oc start-build --from-build ${resourceId}`;
    }

    static followLog(build: string, text: string) {
        return `oc logs ${build}${text} -f`;
    }

    static delete(build: String) {
        return `oc delete build ${build}`;
    }

    static getBuildConfigs() {
        return `oc get buildConfig -o json`;
    }
}

export class Build {
    protected static readonly odo: Odo =    OdoImpl.Instance;

    static async getQuickPicks(cmd: string, errorMessage: string): Promise<QuickPickItem[]> {
        const result = await Build.odo.execute(cmd);
        const json: JSON = JSON.parse(result.stdout);
        if (json['items'].length === 0) {
            throw Error(errorMessage);
        }
        json['items'].forEach((item: any) => {
            item.label = item.metadata.name;
        });
        return json['items'];
    }

    static async getBuildConfigNames(): Promise<QuickPickItem[]> {
        return Build.getQuickPicks(
            Command.getBuildConfigs(),
            'You have no BuildConfigs available to start a build');
    }

    static async getBuildNames(buildConfig: string): Promise<QuickPickItem[]> {
        return Build.getQuickPicks(
            Command.getBuilds(buildConfig),
            'You have no builds available');
    }

    static async selectBuild(context: any, text: string): Promise<string> {
        let build: string = null;
        if (context) {
            build = context.impl.name;
        } else {
            const buildConfig = await Build.selectBuldConfig("Select a BuildConfig to see the builds");
            if (buildConfig)  {
                const selBuild = await window.showQuickPick(this.getBuildNames(buildConfig), {placeHolder: text});
                build = selBuild ? selBuild.label : null;
            }
        }
        return build;
    }

    static async selectBuldConfig(placeHolderText: string): Promise<string> {
        const buildConfig: any = await window.showQuickPick(this.getBuildConfigNames(), {placeHolder: placeHolderText});
        return buildConfig ? buildConfig.label : null;
    }

    static async startBuild(context: { id: any; }): Promise<string> {
        let buildName: string = context ? context.id : undefined;
        let result: Promise<string> = null;
        if (!buildName) buildName = await Build.selectBuldConfig("Select a BuildConfig to start a build");
        if (buildName) {
            result = Progress.execFunctionWithProgress(`Starting build`, () => Build.odo.execute(Command.startBuild(buildName)))
                .then(() => `Build '${buildName}' successfully started`)
                .catch((err) => Promise.reject(`Failed to start build with error '${err}'`));
        }
        return result;
    }

    static async deployApplication(context: { id: any; }): Promise<string> {
        let buildName: string = context ? context.id : undefined;
        let result: Promise<string> = null;
        if (!buildName) buildName = await Build.selectBuldConfig("Select a BuildConfig to start a build");
        if (buildName) {
            result = Progress.execFunctionWithProgress(`Deploying`, () => Build.odo.execute(Command.deploy(buildName)))
                .then(() => `Successfully deploy '${buildName}'`)
                .catch((err) => Promise.reject(`Failed to deploy with error '${err}'`));
        }
        return result;
    }

    static async showLog(context: { impl: any; }): Promise<string> {
        const build = await Build.selectBuild(context, "Select a build too see the logs");
        if (build) {
            Build.odo.executeInTerminal(Command.showLog(build, '-build'));
        }
        return build;
    }

    static async rebuild(context: { id?: string; impl: any; }): Promise<string> {
        let resourceId: string;
        if (context) {
            resourceId = context.impl.name;
        } else {
            const name = await Build.selectBuild(context, "select too rebuild");
            if (name) {
                resourceId = name;
            }
        }
        if (resourceId) {
            Build.odo.executeInTerminal(Command.rebuildFrom(resourceId));
        }
        return null;
    }

    static async followLog(context: { impl: any; }): Promise<string> {
        const build = await Build.selectBuild(context, "Select a build too follow the logs");
        if (build) {
            Build.odo.executeInTerminal(Command.followLog(build, '-build'));
        }
        return null;
    }

    static async delete(context: { impl: any; }): Promise<string> {
        let result: null | string | Promise<string> | PromiseLike<string> = null;
        const build = await Build.selectBuild(context, "Select a build too delete");
        if (build) {
            result = Progress.execFunctionWithProgress(`Starting build`, () => Build.odo.execute(Command.delete(build)))
                .then(() => `Build '${build}' successfully deleted`)
                .catch((err) => Promise.reject(`Failed to delete build with error '${err}'`));
        }
        return result;
    }
}