/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { GitSource, GitProvider, SecretType } from '../types';
import { BaseService } from './base-service';
import { BitbucketService } from './bitbucket-service';
import { GithubService } from './github-service';
import { GitlabService } from './gitlab-service';

export enum ServiceSecretType {
    basicAuth = 'kubernetes.io/basic-auth',
    dockercfg = 'kubernetes.io/dockercfg',
    dockerconfigjson = 'kubernetes.io/dockerconfigjson',
    opaque = 'Opaque',
    serviceAccountToken = 'kubernetes.io/service-account-token',
    sshAuth = 'kubernetes.io/ssh-auth',
    tls = 'kubernetes.io/tls',
}

export function getGitService(
    repository: string,
    gitProvider: GitProvider,
    ref?: string,
    contextDir?: string,
    secret?: { type: string, data: any, 'ssh-privatekey': any },
    devfilePath?: string,
    dockerfilePath?: string,
): BaseService {
    let secretType: SecretType;
    let secretContent: any;
    switch (secret?.type) {
        case ServiceSecretType.basicAuth:
            secretType = SecretType.BASIC_AUTH;
            secretContent = secret.data;
            break;
        case ServiceSecretType.sshAuth:
            secretType = SecretType.SSH;
            secretContent = secret['ssh-privatekey'];
            break;
        default:
            secretType = SecretType.NO_AUTH;
    }
    const gitSource: GitSource = {
        url: repository,
        ref,
        contextDir,
        secretType,
        secretContent,
        devfilePath,
        dockerfilePath,
    };

    switch (gitProvider) {
        case GitProvider.GITHUB:
            return new GithubService(gitSource);
        case GitProvider.BITBUCKET:
            return new BitbucketService(gitSource);
        case GitProvider.GITLAB:
            return new GitlabService(gitSource);
        default:
            return null;
    }
}
