/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { QuickPickItem, window } from "vscode";
import { OdoImpl, Odo } from "../odo";
import { Progress } from "../util/progress";
import { ClusterExplorerV1 } from 'vscode-kubernetes-tools-api';
import * as common from './common';

export class Command {

    static getAllBuilds(parent: ClusterExplorerV1.ClusterExplorerNode) {
        return `get build -o jsonpath="{range .items[?(.metadata.labels.buildconfig=='${(parent as any).name}')]}{.metadata.namespace}{','}{.metadata.name}{','}{.metadata.annotations.openshift\\.io/build\\.number}{\\"\\n\\"}{end}"`;
    }

    static startBuild(buildConfig: string) {
        return `oc start-build ${buildConfig}`;
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

export class BuildConfigNodeContributor implements ClusterExplorerV1.NodeContributor {
    contributesChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): boolean {
        return !!parent && parent.nodeType === 'resource' && parent.resourceKind.manifestKind === 'BuildConfig';
    }

    async getChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<ClusterExplorerV1.Node[]> {
        return common.getChildrenNode(Command.getAllBuilds(parent), 'Build', 'build');
    }
}

export class Build {
    protected static readonly odo: Odo = OdoImpl.Instance;

    static async getBuildConfigNames(msg: string): Promise<QuickPickItem[]> {
        return common.getQuickPicks(
            Command.getBuildConfigs(),
            msg);
    }

    static async getBuildNames(buildConfig: string): Promise<QuickPickItem[]> {
        return common.getQuickPicks(
            Command.getBuilds(buildConfig),
            'You have no builds available');
    }

    static async selectBuild(context: any, text: string): Promise<string> {
        let build: string = null;
        if (context) {
            build = context.impl.name;
        } else {
            const buildConfig = await common.selectResourceByName(Build.getBuildConfigNames("You have no BuildConfigs available"), "Select a BuildConfig to see the builds");
            if (buildConfig)  {
                const selBuild = await window.showQuickPick(this.getBuildNames(buildConfig), {placeHolder: text, ignoreFocusOut: true});
                build = selBuild ? selBuild.label : null;
            }
        }
        return build;
    }

    static async startBuild(context: { name: string; }): Promise<string> {
        let buildName: string = context ? context.name : undefined;
        let result: Promise<string> = null;
        if (!buildName) buildName = await common.selectResourceByName(await Build.getBuildConfigNames("You have no BuildConfigs available to start a build"), "Select a BuildConfig to start a build");
        if (buildName) {
            result = Progress.execFunctionWithProgress(`Starting build`, () => Build.odo.execute(Command.startBuild(buildName)))
                .then(() => `Build '${buildName}' successfully started`)
                .catch((err) => Promise.reject(`Failed to start build with error '${err}'`));
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
            result = Progress.execFunctionWithProgress(`Deleting build`, () => Build.odo.execute(Command.delete(build)))
                .then(() => `Build '${build}' successfully deleted`)
                .catch((err) => Promise.reject(`Failed to delete build with error '${err}'`));
        }
        return result;
    }
}