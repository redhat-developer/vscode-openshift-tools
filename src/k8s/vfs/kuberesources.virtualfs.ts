/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import * as fs from 'fs';
import * as path from 'path';
import * as querystring from 'querystring';
import { Disposable, Event, EventEmitter, FileChangeEvent, FileStat, FileSystemProvider, FileType, Uri } from 'vscode';

import { CommandText } from '../../base/command';
import { CliChannel } from '../../cli';
import { helmSyntaxVersion, HelmSyntaxVersion } from '../../helm/helm';
import { CliExitData } from '../../util/childProcessUtil';
import { Progress } from '../../util/progress';
import { Errorable } from './errorable';

export const K8S_RESOURCE_SCHEME = 'osmsx'; // Changed from 'k8smsx' to 'osmsx' to not make a conflict with k8s extension
export const K8S_RESOURCE_SCHEME_READONLY = 'osmsxro'; // Changed from 'k8smsxro' to 'osmsxro' to not make a conflict with k8s extension
export const KUBECTL_RESOURCE_AUTHORITY = 'loadkubernetescore';
export const KUBECTL_DESCRIBE_AUTHORITY = 'kubernetesdescribe';
export const HELM_RESOURCE_AUTHORITY = 'helmget';

export const OUTPUT_FORMAT_YAML = 'yaml'    // Default
export const OUTPUT_FORMAT_JSON = 'json'

export function findOpenEditor(uri: Uri) {
    const uriWithoutNonce = uri.toString(true).replace(/&_=[0-9]+/g, '');
    return vscode.workspace.textDocuments.map((doc) => doc.uri)
        .find((docUri) => docUri.toString(true).replace(/&_=[0-9]+/g, '') === uriWithoutNonce);
}

export function kubefsUri(namespace: string | null | undefined /* TODO: rationalise null and undefined */,
        value: string, outputFormat: string, action?: string, dedupe?: boolean): Uri {
    const docname = `${value.replace('/', '-')}${outputFormat !== '' ? `.${outputFormat}` : ''}`;
    const nonce = new Date().getTime();
    const nsquery = namespace ? `ns=${namespace}&` : '';
    const scheme = action === 'describe' ? K8S_RESOURCE_SCHEME_READONLY : K8S_RESOURCE_SCHEME;
    const authority = action === 'describe' ? KUBECTL_DESCRIBE_AUTHORITY : KUBECTL_RESOURCE_AUTHORITY;
    const uri = `${scheme}://${authority}/${docname}?${nsquery}value=${value}&_=${nonce}`;
    const newUri = Uri.parse(uri);
    if (!dedupe) {
        return newUri;
    }
    const editedUri = findOpenEditor(newUri);
    return editedUri ? editedUri : newUri;
}

export function helmfsUri(releaseName: string, revision: number | undefined, dedupe?: boolean): vscode.Uri {
    const revisionSuffix = revision ? `-${revision}` : '';
    const revisionQuery = revision ? `&revision=${revision}` : '';

    const docname = `helmrelease-${releaseName}${revisionSuffix}.txt`;
    const nonce = new Date().getTime();
    const uri = `${K8S_RESOURCE_SCHEME}://${HELM_RESOURCE_AUTHORITY}/${docname}?value=${releaseName}${revisionQuery}&_=${nonce}`;
    const newUri = Uri.parse(uri);
    if (!dedupe) {
        return newUri;
    }
    const editedUri = findOpenEditor(newUri);
    return editedUri ? editedUri : newUri;
}

/**
 * Get output format from openshiftToolkit.outputFormat
 * default yaml
 *
 * @returns output format
 */
export function getOutputFormat(): string {
    return vscode.workspace.getConfiguration('openshiftToolkit').get('outputFormat');
}

export class KubernetesResourceVirtualFileSystemProvider implements FileSystemProvider {
    constructor() { }

    private readonly onDidChangeFileEmitter: EventEmitter<FileChangeEvent[]> = new EventEmitter<FileChangeEvent[]>();

    onDidChangeFile: Event<FileChangeEvent[]> = this.onDidChangeFileEmitter.event;

    watch(_uri: Uri, _options: { recursive: boolean; excludes: string[] }): Disposable {
        // It would be quite neat to implement this to watch for changes
        // in the cluster and update the doc accordingly.  But that is very
        // definitely a future enhancement thing!
        return new Disposable(() => {});
    }

    stat(_uri: Uri): FileStat {
        return {
            type: FileType.File,
            ctime: 0,
            mtime: 0,
            size: 65536  // These files don't seem to matter for us
        };
    }

    readDirectory(_uri: Uri): [string, FileType][] | Thenable<[string, FileType][]> {
        return [];
    }

    createDirectory(_uri: Uri): void | Thenable<void> {
        // no-op
    }

    readFile(uri: Uri): Uint8Array | Thenable<Uint8Array> {
        return this.readFileAsync(uri);
    }

    async readFileAsync(uri: Uri): Promise<Uint8Array> {
        const content = await this.loadResource(uri);
        return new Buffer(content, 'utf8');
    }

    async loadResource(uri: Uri): Promise<string> {
        const query = querystring.parse(uri.query);

        const outputFormat = getOutputFormat();
        const value = query.value as string;
        const revision = query.revision as string | undefined;
        const ns = query.ns as string | undefined;
        const resourceAuthority = uri.authority;

        const eer = await this.execLoadResource(resourceAuthority, ns, value, revision, outputFormat);
        if (Errorable.failed(eer)) {
            void vscode.window.showErrorMessage(eer.error[0]);
            throw new Error(eer.error[0]);
        }

        const er = eer.result;
        if (CliExitData.failed(er)) {
            const message = `Get command failed: ${CliExitData.getErrorMessage(er)}`;
            void vscode.window.showErrorMessage(message);
            throw new Error(message);
        }

        return er.stdout;
    }

    async execLoadResource(resourceAuthority: string, ns: string | undefined, value: string, revision: string | undefined, outputFormat: string): Promise<Errorable<CliExitData>> {
        const nsarg = ns ? `--namespace ${ns}` : '';
        switch (resourceAuthority) {
            case KUBECTL_RESOURCE_AUTHORITY: {
                const ced = await Progress.execFunctionWithProgress(`Loading ${value}...`, async () => {
                        return await CliChannel.getInstance().executeTool(new CommandText(`oc -o ${outputFormat} ${nsarg} get ${value}`), undefined, false);
                    });
                return { succeeded: true, result: ced };
            }
            case HELM_RESOURCE_AUTHORITY: {
                const scopearg = ((await helmSyntaxVersion()) === HelmSyntaxVersion.V2) ? '' : 'all';
                const revarg = revision ? ` --revision=${revision}` : '';
                const her = await Progress.execFunctionWithProgress(`Loading ${value}...`, async () => {
                        return await CliChannel.getInstance().executeTool(new CommandText(`helm get ${scopearg} ${value}${revarg}`), undefined, false);
                    });
                return { succeeded: true, result: her };
            }
            case KUBECTL_DESCRIBE_AUTHORITY: {
                const describe = await Progress.execFunctionWithProgress(`Loading ${value}...`, async () => {
                        return await CliChannel.getInstance().executeTool(new CommandText(`oc describe ${value} ${nsarg}`), undefined, false);
                    });
                return { succeeded: true, result: describe };
            }
            default:
                return { succeeded: false, error: [`Internal error: please raise an issue with the error code InvalidObjectLoadURI and report authority ${resourceAuthority}.`] };
        }
    }

    writeFile(uri: Uri, content: Uint8Array, _options: { create: boolean; overwrite: boolean }): void | Thenable<void> {
        return this.saveAsync(uri, content);  // TODO: respect options
    }

    private async saveAsync(uri: Uri, content: Uint8Array): Promise<void> {
        // This assumes no pathing in the URI - if this changes, we'll need to
        // create subdirectories.
        // TODO: not loving prompting as part of the write when it should really be part of a separate
        // 'save' workflow - but needs must, I think
        const rootPath = await this.selectRootFolder();
        if (!rootPath) {
            return;
        }
        const fspath = path.join(rootPath, uri.fsPath);
        fs.writeFileSync(fspath, content);
    }

    delete(_uri: Uri, _options: { recursive: boolean }): void | Thenable<void> {
        // no-op
    }

    rename(_oldUri: Uri, _newUri: Uri, _options: { overwrite: boolean }): void | Thenable<void> {
        // no-op
    }

    private async showWorkspaceFolderPick(): Promise<vscode.WorkspaceFolder | undefined> {
        if (!vscode.workspace.workspaceFolders) {
            void vscode.window.showErrorMessage('This command requires an open folder.');
            return undefined;
        } else if (vscode.workspace.workspaceFolders.length === 1) {
            return vscode.workspace.workspaceFolders[0];
        }
        return await vscode.window.showWorkspaceFolderPick();
    }

    private async selectRootFolder(): Promise<string | undefined> {
        const folder = await this.showWorkspaceFolderPick();
        if (!folder) {
            return undefined;
        }
        if (folder.uri.scheme !== 'file') {
            void vscode.window.showErrorMessage('This command requires a filesystem folder');  // TODO: make it not
            return undefined;
        }
        return folder.uri.fsPath;
    }
}
