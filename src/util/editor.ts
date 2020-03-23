/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Uri, FileSystemProvider, FileType, FileStat, FileChangeEvent, Event, EventEmitter, Disposable } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export const OPENSHIFT_RESOURCE_SCHEME = "component";
export const OPENSHIFT_RESOURCE_AUTHORITY = "logs";

export function openshiftfsUri(value: string): Uri {
    const docname = `${value}`;
    const nonce = new Date().getTime();
    const uri = `${OPENSHIFT_RESOURCE_SCHEME}://${OPENSHIFT_RESOURCE_AUTHORITY}/${docname}?value=${value}&_=${nonce}`;
    return Uri.parse(uri);
}

export class EditorResourceProvider implements FileSystemProvider {

    private readonly onDidChangeFileEmitter: EventEmitter<FileChangeEvent[]> = new EventEmitter<FileChangeEvent[]>();

    onDidChangeFile: Event<FileChangeEvent[]> = this.onDidChangeFileEmitter.event;

    watch(): Disposable {
        // It would be quite neat to implement this to watch for changes
        // in the cluster and update the doc accordingly.  But that is very
        // definitely a future enhancement thing!
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        return new Disposable(() => { });
    }

    stat(): FileStat {
        return {
            type: FileType.File,
            ctime: 0,
            mtime: 0,
            size: 65536  // These files don't seem to matter for us
        };
    }

    readDirectory(): [string, FileType][] | Thenable<[string, FileType][]> {
        return [];
    }

    createDirectory(): void | Thenable<void> {
        // no-op
    }

    readFile(): Uint8Array | Thenable<Uint8Array> {
        return new Buffer('', 'utf8');
    }

    writeFile(uri: Uri, content: Uint8Array): void | Thenable<void> {
        return this.saveAsync(uri, content);  // TODO: respect options
    }

    saveAsync(uri: Uri, content: Uint8Array): Promise<void> {
        const tempPath = os.tmpdir();
        if (!tempPath) {
          return;
        }
        const fsPath = path.join(tempPath, uri.fsPath);
        fs.writeFileSync(fsPath, content);
    }

    delete(): void | Thenable<void> {
        // no-op
    }

    rename(): void | Thenable<void> {
        // no-op
    }
}
