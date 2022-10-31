/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
export enum SecretType {
  NO_AUTH,
  BASIC_AUTH,
  SSH,
  PERSONAL_ACCESS_TOKEN,
  OAUTH,
}

export interface GitSource {
  url: string;
  secretType?: SecretType;
  secretContent?: any;
  ref?: string;
  contextDir?: string;
  devfilePath?: string;
  dockerfilePath?: string;
}

export enum GitProvider {
  GITHUB = 'github',
  BITBUCKET = 'bitbucket',
  GITLAB = 'gitlab',
  UNSURE = 'other',
  INVALID = '',
}

export enum ImportStrategy {
  S2I,
  DOCKERFILE,
  DEVFILE,
}
