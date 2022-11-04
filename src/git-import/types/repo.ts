/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
export interface RepoMetadata {
  repoName: string;
  owner: string;
  host: string;
  defaultBranch?: string;
  fullName?: string;
  contextDir?: string;
  devfilePath?: string;
  dockerfilePath?: string;
}

export interface BranchList {
  branches: string[];
}

export interface RepoLanguageList {
  languages: string[];
}

export interface RepoFileList {
  files: string[];
}

export interface Response {
    status: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error?: any
}

// eslint-disable-next-line no-shadow
export enum RepoStatus {
  Reachable,
  Unreachable,
  RateLimitExceeded,
}
