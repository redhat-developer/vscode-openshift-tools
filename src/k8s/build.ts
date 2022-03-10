/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { QuickPickItem, window } from 'vscode';
import { ClusterExplorerV1 } from 'vscode-kubernetes-tools-api';
import { OdoImpl, Odo } from '../odo';
import { Progress } from '../util/progress';
import * as common from './common';
import { vsCommand, VsCommandError } from '../vscommand';
import { CommandOption, CommandText } from '../base/command';

export class Build {

    public static command = {
      getAllBuilds(parent: ClusterExplorerV1.ClusterExplorerNode): CommandText {
          return new CommandText('get build',
            undefined, [
                new CommandOption('-o', `jsonpath="{range .items[?(.metadata.labels.buildconfig=='${(parent as any).name}')]}{.metadata.namespace}{','}{.metadata.name}{','}{.metadata.annotations.openshift\\.io/build\\.number}{\\"\\n\\"}{end}"`)
            ]
          );
      },
      startBuild(buildConfig: string): CommandText {
          return new CommandText('oc start-build', buildConfig);
      },
      getBuilds(build: string): CommandText {
          return new CommandText('oc get build',
            undefined, [
                new CommandOption('-l', `buildconfig=${build}`),
                new CommandOption('-o', 'json', false)
            ]
        );
      },
      showLog(build: string, text: string): CommandText {
          return new CommandText('oc logs', `${build}${text}`);
      },
      rebuildFrom(resourceId: string): CommandText {
          return new CommandText('oc start-build',
            undefined, [
                new CommandOption('--from-build', resourceId)
            ]
        );
      },
      followLog(build: string, text: string): CommandText {
          return new CommandText('oc logs', `${build}${text}`, [
              new CommandOption('-f')
          ]
        );
      },
      delete(build: string): CommandText {
          return new CommandText('oc delete build',build);
      },
      getBuildConfigs(): CommandText {
          return new CommandText('oc get buildConfig -o json');
      }
  };

    protected static readonly odo: Odo = OdoImpl.Instance;

    static getNodeContributor(): ClusterExplorerV1.NodeContributor {
      return {
          contributesChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): boolean {
             return !!parent && parent.nodeType === 'resource' && parent.resourceKind.manifestKind === 'BuildConfig';
          },
          async getChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<ClusterExplorerV1.Node[]> {
              return common.getChildrenNode(Build.command.getAllBuilds(parent), 'Build', 'build');
          }
      };
    }

    static async getBuildConfigNames(msg: string): Promise<QuickPickItem[]> {
        return common.getQuickPicks(Build.command.getBuildConfigs(), msg);
    }

    static async getBuildNames(buildConfig: string): Promise<QuickPickItem[]> {
        return common.getQuickPicks(Build.command.getBuilds(buildConfig), 'You have no builds available');
    }

    static async selectBuild(context: any, text: string): Promise<string> {
        let build: string = null;
        if (context) {
            build = context.impl.name;
        } else {
            const buildConfig = await common.selectResourceByName(Build.getBuildConfigNames('You have no BuildConfigs available'), 'Select a BuildConfig to see the builds');
            if (buildConfig)  {
                const selBuild = await window.showQuickPick(this.getBuildNames(buildConfig), {placeHolder: text, ignoreFocusOut: true});
                build = selBuild ? selBuild.label : null;
            }
        }
        return build;
    }

    @vsCommand('clusters.openshift.build.start')
    static async startBuild(context: { name: string}): Promise<string> {
        let buildName: string = context ? context.name : undefined;
        let result: Promise<string> = null;
        if (!buildName) buildName = await common.selectResourceByName(await Build.getBuildConfigNames('You have no BuildConfigs available to start a build'), 'Select a BuildConfig to start a build');
        if (buildName) {
            result = Progress.execFunctionWithProgress('Starting build', () => Build.odo.execute(Build.command.startBuild(buildName)))
                .then(() => `Build '${buildName}' successfully started`)
                .catch((err) => Promise.reject(new VsCommandError(`Failed to start build with error '${err}'`, 'Failed to start build')));
        }
        return result;
    }

    @vsCommand('clusters.openshift.build.showLog', true)
    static async showLog(context: { impl: any}): Promise<string> {
        const build = await Build.selectBuild(context, 'Select a Build to see the logs');
        if (build) {
            Build.odo.executeInTerminal(Build.command.showLog(build, '-build'), undefined, `OpenShift: Show '${build}' Build Log`);
        }
        return null;
    }

    @vsCommand('clusters.openshift.build.rebuild')
    static async rebuild(context: { id?: string; impl: any}): Promise<string> {
        let resourceId: string;
        if (context) {
            resourceId = context.impl.name;
        } else {
            const name = await Build.selectBuild(context, 'Select build to rebuild');
            if (name) {
                resourceId = name;
            }
        }
        if (resourceId) {
            Build.odo.executeInTerminal(Build.command.rebuildFrom(resourceId), undefined, `OpenShift: Rebuild '${resourceId}' Build`);
        }
        return null;
    }

    @vsCommand('clusters.openshift.build.followLog')
    static async followLog(context: { impl: any}): Promise<string> {
        const build = await Build.selectBuild(context, 'Select a build to follow the logs');
        if (build) {
            Build.odo.executeInTerminal(Build.command.followLog(build, '-build'), undefined, `OpenShift: Follow '${build}' Build Log`);
        }
        return null;
    }

    @vsCommand('clusters.openshift.build.delete', true)
    static async delete(context: { impl: any}): Promise<string> {
        let result: null | string | Promise<string> | PromiseLike<string> = null;
        const build = await Build.selectBuild(context, 'Select a build to delete');
        if (build) {
            result = Progress.execFunctionWithProgress('Deleting build', () => Build.odo.execute(Build.command.delete(build)))
                .then(() => `Build '${build}' successfully deleted`)
                .catch((err) => Promise.reject(new VsCommandError(`Failed to delete build with error '${err}'`, 'Failed to delete build')));
        }
        return result;
    }
}
