/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as vscode from 'vscode';

export interface GitCloneOptions {
    url: string;
    location: string;
    branch?: string;

    onStart?: () => void;
    onProgress?: (data: string) => void;
    onLog?: (data: string) => void;
}

export interface CloneResult {
    status: boolean;
    error?: string;
}

export async function cloneRepository(options: GitCloneOptions): Promise<CloneResult> {
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (!gitExtension) {
        return {
            status: false,
            error: 'VS Code Git extension is not available'
        };
    }

    let gitApi;
    try {
        gitApi = gitExtension.exports.getAPI(1);
    } catch (error) {
        return {
            status: false,
            error: `Failed to get Git API: ${error.message}`
        };
    }

    if (!gitApi?.git?.path) {
        return {
            status: false,
            error: 'Unable to locate git executable from VS Code Git API'
        };
    }

    const git = gitApi.git.path;

    if (typeof git !== 'string' || git.trim().length === 0) {
        return {
            status: false,
            error: 'Git executable path is invalid'
        };
    }

    const args = [
        'clone',
        '--progress',
        options.url,
        options.location
    ];

    if (options.branch) {
        args.push('--branch', options.branch);
    }

    options.onLog?.(
        `${git} ${args.join(' ')}`
    );

    options.onStart?.();

    return new Promise((resolve) => {
        const proc = cp.spawn(git, args);

        proc.stdout.on('data', (data: Buffer) => {
            const text = data.toString();

            options.onLog?.(text);
        });

        proc.stderr.on('data', (data: Buffer) => {
            const text = data.toString();

            // git clone progress usually comes via stderr
            options.onProgress?.(text);

            options.onLog?.(text);
        });

        proc.on('error', (error) => {
            resolve({
                status: false,
                error: error.message
            });
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve({
                    status: true
                });

                return;
            }

            resolve({
                status: false,
                error: `git clone exited with code ${code}`
            });
        });
    });
}