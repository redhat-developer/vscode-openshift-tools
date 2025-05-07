/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import * as querystring from 'querystring';
import { Disposable, Event, EventEmitter, FileChangeEvent, FileStat, FileSystemProvider, FileType, Uri } from 'vscode';
import { CommandOption, CommandText } from '../../base/command';
import { CliChannel } from '../../cli';
import { helmSyntaxVersion, HelmSyntaxVersion } from '../../helm/helm';
import { Oc } from '../../oc/ocWrapper';
import { CliExitData } from '../../util/childProcessUtil';
import { Progress } from '../../util/progress';
import { Errorable } from './errorable';
import { getOutputFormat, HELM_RESOURCE_AUTHORITY, K8sResourceCache, KUBECTL_DESCRIBE_AUTHORITY, KUBECTL_RESOURCE_AUTHORITY, Neater } from './kuberesources.utils';

export class KubernetesResourceVirtualFileSystemProvider implements FileSystemProvider {
    private encoder = new TextEncoder();

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
        return K8sResourceCache.Instance.getStat(_uri);
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
        return Uint8Array.from(this.encoder.encode(content));
    }

    async loadResource(uri: Uri): Promise<string> {
        const outputFormat = getOutputFormat();
        const query = querystring.parse(uri.query);
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

        K8sResourceCache.Instance.set(uri, er.stdout);
        return er.stdout;
    }

    async execLoadResource(resourceAuthority: string, ns: string | undefined, value: string, revision: string | undefined, outputFormat: string): Promise<Errorable<CliExitData>> {
        const nsarg = ns ? `--namespace ${ns}` : '';
        switch (resourceAuthority) {
            case KUBECTL_RESOURCE_AUTHORITY: {
                const ced = await Progress.execFunctionWithProgress(`Loading ${value}...`, async () => {
                        const options = [];
                        options.push(new CommandOption('-o', outputFormat, false, false));
                        if (ns) {
                            options.push(new CommandOption('--namespace', ns));
                        }

                        return await CliChannel.getInstance().executeTool(
                            new CommandText('oc', `get ${value}`, options), undefined, false);
                    });
                return { succeeded: true, result: ced };
            }
            case HELM_RESOURCE_AUTHORITY: {
                const scopearg = ((await helmSyntaxVersion()) === HelmSyntaxVersion.V2) ? '' : 'all';
                const revarg = revision ? ` --revision=${revision}` : '';
                const her = await Progress.execFunctionWithProgress(`Loading ${value}...`, async () => {
                        return await CliChannel.getInstance().executeTool(new CommandText(`helm get ${scopearg} ${value}${revarg} -o ${outputFormat}`), undefined, false);
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
        const neatContent = await Neater.neat(content.toString());

        let errors: vscode.Diagnostic[];
        try {
            errors = await K8sResourceCache.Instance.validateResourceDocument(uri, neatContent);
        } catch (_err) {
            void vscode.window.showErrorMessage(`An exception happened during the Validation: ${_err}`);
            throw vscode.FileSystemError.Unavailable(_err);
        }

        if (!errors || errors.length === 0) {
            await Oc.Instance.applyConfiguration(neatContent);
        } else {
            const shortcut = process.platform === 'darwin' ? '⇧⌘M' : 'Ctrl+Shift+M';
            const errorMsg = '⚠️  The Kubernetes Resource cannot be saved due to the potential SSA conflicts. ' +
                `See the Problems panel (${shortcut}) for details.`;
            await vscode.commands.executeCommand('workbench.actions.view.problems');
            throw vscode.FileSystemError.NoPermissions(errorMsg);
        }
    }

    delete(_uri: Uri, _options: { recursive: boolean }): void | Thenable<void> {
        // no-op
    }

    rename(_oldUri: Uri, _newUri: Uri, _options: { overwrite: boolean }): void | Thenable<void> {
        // no-op
    }
}

