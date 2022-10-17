/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import 'whatwg-fetch';
import {
    GitSource,
    SecretType,
    RepoMetadata,
    BranchList,
    RepoLanguageList,
    RepoFileList,
    RepoStatus,
    Response
} from '../types';
import { BaseService } from './base-service';
import { Base64 } from 'js-base64';
import { ParseBitbucketUrl } from 'parse-bitbucket-url';

export class BitbucketService extends BaseService {
    private readonly metadata: RepoMetadata;

    private baseURL = 'https://api.bitbucket.org/2.0';

    private isServer = false;

    constructor(gitsource: GitSource) {
        super(gitsource);
        this.metadata = this.getRepoMetadata();
        if (this.metadata.host !== 'bitbucket.org') {
            this.baseURL = `https://${this.metadata.host}/rest/api/1.0`;
            this.isServer = true;
        }
    }

    protected getAuthProvider = (): any => {
        switch (this.gitsource.secretType) {
            case SecretType.BASIC_AUTH: {
                const { username, password } = this.gitsource.secretContent;
                const encodedAuth = Base64.encode(`${Base64.decode(username)}:${Base64.decode(password)}`);
                return { Authorization: `Basic ${encodedAuth}` };
            }
            default:
                return null;
        }
    };

    protected fetchJson = async (url: string) => {
        const authHeaders = this.getAuthProvider();
        const response = await fetch(url, { headers: { Accept: 'application/json', ...authHeaders } });
        if (!response.ok) {
            throw response;
        }
        if (response.headers.get('Content-Type') === 'text/plain') {
            return response.text();
        }
        return response.json();
    };

    getRepoMetadata = (): RepoMetadata => {
        const { name, owner, host } = ParseBitbucketUrl(this.gitsource.url);
        const contextDir = this.gitsource.contextDir?.replace(/\/$/, '') || '';
        return {
            repoName: name,
            owner,
            host,
            defaultBranch: this.gitsource.ref || 'HEAD',
            contextDir,
            devfilePath: this.gitsource.devfilePath,
            dockerfilePath: this.gitsource.dockerfilePath,
        };
    };

    isRepoReachable = async (): Promise<RepoStatus> => {
        const url = this.isServer
            ? `${this.baseURL}/projects/${this.metadata.owner}/repos/${this.metadata.repoName}`
            : `${this.baseURL}/repositories/${this.metadata.owner}/${this.metadata.repoName}`;
        try {
            const data = await this.fetchJson(url);
            if (data.slug === this.metadata.repoName) {
                return RepoStatus.Reachable;
            }
        } catch (e) {
            if (e.status === 429) {
                return RepoStatus.RateLimitExceeded;
            }
        }
        return RepoStatus.Unreachable;
    };

    getRepoBranchList = async (): Promise<BranchList> => {
        const url = this.isServer
            ? `${this.baseURL}/projects/${this.metadata.owner}/repos/${this.metadata.repoName}/branches`
            : `${this.baseURL}/repositories/${this.metadata.owner}/${this.metadata.repoName}/refs/branches`;
        try {
            const data = await this.fetchJson(url);
            const list = data.values.map((b) => b.name);
            return { branches: list };
        } catch (e) {
            return { branches: [] };
        }
    };

    getRepoFileList = async (): Promise<RepoFileList> => {
        const url = this.isServer
            ? `${this.baseURL}/projects/${this.metadata.owner}/repos/${this.metadata.repoName}/files/${this.metadata.contextDir}?limit=50&at=${this.metadata.defaultBranch}`
            : `${this.baseURL}/repositories/${this.metadata.owner}/${this.metadata.repoName}/src/${this.metadata.defaultBranch}/${this.metadata.contextDir}?pagelen=50`;
        try {
            const data = await this.fetchJson(url);
            const files = this.isServer ? data.values : data.values?.map((f) => f.path) || [];
            return { files };
        } catch (e) {
            return { files: [] };
        }
    };

    getRepoLanguageList = async (): Promise<RepoLanguageList> => {
        const url = this.isServer
            ? `${this.baseURL}/projects/${this.metadata.owner}/repos/${this.metadata.repoName}`
            : `${this.baseURL}/repositories/${this.metadata.owner}/${this.metadata.repoName}`;
        try {
            const data = await this.fetchJson(url);
            return { languages: [data.language] };
        } catch (e) {
            return { languages: [] };
        }
    };

    isFilePresent = async (path: string): Promise<Response> => {
        const filePath = path.replace(/^\//, '');
        const url = this.isServer
            ? `${this.baseURL}/projects/${this.metadata.owner}/repos/${this.metadata.repoName}/raw/${filePath}?at=${this.metadata.defaultBranch}`
            : `${this.baseURL}/repositories/${this.metadata.owner}/${this.metadata.repoName}/src/${this.metadata.defaultBranch}/${filePath}`;
        try {
            await this.fetchJson(url);
            return { status: true };
        } catch (e) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            return { status: false, error: e };
        }
    };

    getFileContent = async (path: string): Promise<string | null> => {
        const filePath = path.replace(/^\//, '');
        const url = this.isServer
            ? `${this.baseURL}/projects/${this.metadata.owner}/repos/${this.metadata.repoName}/raw/${filePath}?at=${this.metadata.defaultBranch}`
            : `${this.baseURL}/repositories/${this.metadata.owner}/${this.metadata.repoName}/src/${this.metadata.defaultBranch}/${filePath}`;
        try {
            const data = await this.fetchJson(url);
            return data as string;
        } catch (e) {
            return null;
        }
    };

    isDockerfilePresent = () =>
        this.isFilePresent(`${this.metadata.contextDir}/${this.metadata.dockerfilePath}`);

    getDockerfileContent = () =>
        this.getFileContent(`${this.metadata.contextDir}/${this.metadata.dockerfilePath}`);

    isDevfilePresent = () =>
        this.isFilePresent(`${this.metadata.contextDir}/${this.metadata.devfilePath}`);

    getDevfileContent = () =>
        this.getFileContent(`${this.metadata.contextDir}/${this.metadata.devfilePath}`);

    getPackageJsonContent = () => this.getFileContent(`${this.metadata.contextDir}/package.json`);
}
