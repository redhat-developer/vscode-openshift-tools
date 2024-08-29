/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { OctokitOptions } from '@octokit/core';
import { Octokit } from '@octokit/rest';
import * as GitUrlParse from 'git-url-parse';
import { Base64 } from 'js-base64';

export interface GitSource {
    url: string;
    secretType?: SecretType;
    secretContent?: any;
    ref?: string;
    contextDir?: string;
    devfilePath?: string;
    dockerfilePath?: string;
}

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

export enum SecretType {
    NO_AUTH,
    BASIC_AUTH,
    SSH,
    PERSONAL_ACCESS_TOKEN,
    OAUTH,
}

export enum RepoStatus {
    Reachable,
    Unreachable,
    RateLimitExceeded,
    GitTypeNotDetected,
    InvalidGitTypeSelected,
    PrivateRepo,
    ResourceNotFound,
    GiteaRepoUnreachable,
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

export enum GitProvider {
    GITHUB = 'github',
    BITBUCKET = 'bitbucket',
    GITLAB = 'gitlab',
    GITEA = 'gitea',
    UNSURE = 'other',
    INVALID = '',
}

export class GithubService {
    private readonly client: Octokit;

    private readonly metadata: RepoMetadata;
    private readonly gitsource: GitSource;

    constructor(gitsource: GitSource) {
        this.gitsource = gitsource;
        const authOpts = this.getAuthProvider();
        this.metadata = this.getRepoMetadata();
        const baseUrl =
            this.metadata.host === 'github.com' ? null : `https://${this.metadata.host}/api/v3`;
        this.client = new Octokit({ ...authOpts, baseUrl } as OctokitOptions);
    }

    protected getAuthProvider = (): OctokitOptions => {
        switch (this.gitsource.secretType) {
            case SecretType.PERSONAL_ACCESS_TOKEN:
            case SecretType.BASIC_AUTH:
            case SecretType.OAUTH:
                return { auth: Base64.decode(this.gitsource.secretContent.password) };
            default:
                return {};
        }
    };

    protected getRepoMetadata = (): RepoMetadata => {
        const { name, owner, source } = GitUrlParse(this.gitsource.url);
        const contextDir = this.gitsource.contextDir?.replace(/\/$/, '') || '';
        return {
            repoName: name,
            owner,
            host: source,
            defaultBranch: this.gitsource.ref,
            contextDir,
            devfilePath: this.gitsource.devfilePath,
            dockerfilePath: this.gitsource.dockerfilePath,
        };
    };

    isRepoReachable = async (): Promise<RepoStatus> => {
        try {
            const resp = await this.client.repos.get({
                owner: this.metadata.owner,
                repo: this.metadata.repoName,
            });

            if (resp.status === 200) {
                return RepoStatus.Reachable;
            }
        } catch (e) {
            switch (e.status) {
                case 403: {
                    return RepoStatus.RateLimitExceeded;
                }
                case 404: {
                    return RepoStatus.PrivateRepo;
                }
                case 422: {
                    return RepoStatus.InvalidGitTypeSelected;
                }
                default: {
                    return RepoStatus.Unreachable;
                }
            }
        }
        return RepoStatus.Unreachable;
    };

    getRepoBranchList = async (): Promise<BranchList> => {
        try {
            const resp = await this.client.repos.listBranches({
                owner: this.metadata.owner,
                repo: this.metadata.repoName,
            });
            const list = resp.data.map((r) => {
                return r.name;
            });
            return { branches: list };
        } catch {
            return { branches: [] };
        }
    };

    getRepoFileList = async (params?: { specificPath?: string }): Promise<RepoFileList> => {
        try {
            const resp = await this.client.repos.getContent({
                owner: this.metadata.owner,
                repo: this.metadata.repoName,
                ...(params && params?.specificPath
                    ? { path: `${this.metadata.contextDir}/${params.specificPath}` }
                    : { path: this.metadata.contextDir }),
                ...(this.metadata.defaultBranch ? { ref: this.metadata.defaultBranch } : {}),
            });
            let files = [];
            if (resp.status === 200 && Array.isArray(resp.data)) {
                files = resp.data.map((t) => t.name);
            }
            return { files };
        } catch {
            return { files: [] };
        }
    };

    getRepoLanguageList = async (): Promise<RepoLanguageList> => {
        try {
            const resp = await this.client.repos.listLanguages({
                owner: this.metadata.owner,
                repo: this.metadata.repoName,
            });
            if (resp.status === 200) {
                return { languages: Object.keys(resp.data) };
            }
            return { languages: [] };
        } catch {
            return { languages: [] };
        }
    };

    isFilePresent = async (path: string): Promise<boolean> => {
        try {
            const resp = await this.client.repos.getContent({
                owner: this.metadata.owner,
                repo: this.metadata.repoName,
                path,
                ...(this.metadata.defaultBranch ? { ref: this.metadata.defaultBranch } : {}),
            });
            return resp.status === 200;
        } catch {
            return false;
        }
    };

    getFileContent = async (path: string): Promise<string | null> => {
        try {
            const resp = await this.client.repos.getContent({
                owner: this.metadata.owner,
                repo: this.metadata.repoName,
                path,
                ...(this.metadata.defaultBranch ? { ref: this.metadata.defaultBranch } : {}),
            });
            if (resp.status === 200) {
                // eslint-disable-next-line dot-notation
                return Buffer.from(resp.data['content'], 'base64').toString();
            }
            return null;
        } catch {
            return null;
        }
    };

    isDockerfilePresent = async () =>
        await this.isFilePresent(`${this.metadata.contextDir}/${this.metadata.dockerfilePath}`);

    isTektonFolderPresent = async () => await this.isFilePresent(`${this.metadata.contextDir}/.tekton`);

    getDockerfileContent = async () =>
        await this.getFileContent(`${this.metadata.contextDir}/${this.metadata.dockerfilePath}`);

    isFuncYamlPresent = async () =>
        await this.isFilePresent(`${this.metadata.contextDir}/func.yaml`) ||
        await this.isFilePresent(`${this.metadata.contextDir}/func.yml`);

    getFuncYamlContent = async () =>
        await this.getFileContent(`${this.metadata.contextDir}/func.yaml`) ||
        await this.getFileContent(`${this.metadata.contextDir}/func.yml`);

    isDevfilePresent = async () =>
        await this.isFilePresent(`${this.metadata.contextDir}/${this.metadata.devfilePath}`);

    getDevfileContent = async () =>
        await this.getFileContent(`${this.metadata.contextDir}/${this.metadata.devfilePath}`);

    getPackageJsonContent = async () => await this.getFileContent(`${this.metadata.contextDir}/package.json`);
}
