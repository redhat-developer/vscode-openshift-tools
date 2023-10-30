/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { API, Branch, Ref, Remote } from './git.d';

const GIT_EXTENSION_ID = 'vscode.git';

export interface GitState {
  readonly remotes: Remote[];
  readonly refs: Ref[];
  readonly remote: Remote;
  readonly branch: Branch;
  readonly isGit: boolean;
}

export interface GitModel {
  readonly remoteUrl: string;
  readonly branchName: string;
}

export function getGitAPI(): API {
  const extension = vscode.extensions.getExtension(GIT_EXTENSION_ID);
  if (!extension) {
    return null;
  }
  const gitExtension = extension.exports;
  if (!gitExtension) {
    return null;
  }
  return gitExtension.getAPI(1);
}

function getRemoteByCommit(refs: Ref[], remotes: Remote[], branch: Branch): Remote {
  const refsByCommit = refs
    .map((r) => {
      if (r.remote && r.name) {
        return {
          ...r,
          name: r.name.replace(`${r.remote}/`, ''),
        };
      }
      return r;
    })
    .filter((r) => r.commit === branch.commit && r.name === branch.name)
    .sort((a, b) => {
      if (!a.remote) {
        return 1;
      }
      if (!b.remote) {
        return -1;
      }
      return a.remote.localeCompare(b.remote);
    });
  const remoteNameByCommit = refsByCommit[0]?.remote;
  if (remoteNameByCommit) {
    return remotes.filter((r) => r.name === remoteNameByCommit)[0];
  }
  return undefined;
}

export function getGitStateByPath(rootPath?: string): GitState {
  let remotes: Remote[] = [];
  let refs: Ref[] = [];
  let remote: Remote;
  let branch: Branch;
  let isGit = false;

  const api = getGitAPI();
  if (api) {
    const repositories = api.repositories.filter((r) => r.rootUri.fsPath === rootPath);
    isGit = repositories.length > 0;
    if (isGit) {
      const repo = repositories[0];
      remotes = repo.state.remotes;
      refs = repo.state.refs;
      branch = repo.state.HEAD;
      if (branch.commit) {
        remote = getRemoteByCommit(refs, remotes, branch);
      }
    }
  }

  return {
    remotes,
    refs,
    remote,
    branch,
    isGit,
  };
}

function showWarningByState(gitState: GitState) {
  if (!gitState.isGit) {
    void vscode.window.showWarningMessage(
      'This project is not a git repository. Please git initialise it and then proceed to build it on the cluster.',
    );
  }

  if (!gitState.remote && gitState.branch) {
    void vscode.window.showWarningMessage(
      'The local branch is not present remotely. Push it to remote and then proceed to build it on cluster.',
    );
  }
}

function showGitQuickPick(
  gitState: GitState,
  title: string,
  value: string,
  items: vscode.QuickPickItem[],
): Promise<string | undefined> {
  showWarningByState(gitState);
  return new Promise<string | undefined>((resolve, _reject) => {
    const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();
    quickPick.items = items;
    quickPick.value = value;
    quickPick.onDidHide(() => {
      resolve(undefined);
      quickPick.dispose();
    });
    quickPick.onDidChangeSelection((e) => {
      quickPick.value = e[0].label;
    });
    quickPick.onDidAccept(() => {
      resolve(quickPick.value);
      quickPick.dispose();
    });
    quickPick.canSelectMany = false;
    quickPick.ignoreFocusOut = true;
    quickPick.title = title;
    quickPick.show();
  });
}

export async function getGitRepoInteractively(gitState: GitState): Promise<string | undefined> {
  return showGitQuickPick(
    gitState,
    'Provide the git repository with the function source code',
    gitState.remote?.name,
    gitState.remotes.map((r) => ({
      label: r.name,
      description: r.fetchUrl,
    })),
  );
}

export async function getGitBranchInteractively(gitState: GitState, repository: string): Promise<string | undefined> {
  return showGitQuickPick(
    gitState,
    'Git revision to be used (branch, tag, commit).',
    gitState.branch?.name,
    gitState.refs
      .filter((r) => repository === r.remote)
      .map((r) => ({
        label: r.name?.replace(`${repository}/`, ''),
      })),
  );
}
