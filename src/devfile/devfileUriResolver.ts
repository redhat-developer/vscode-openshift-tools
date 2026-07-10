/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as path from 'path';
import got from 'got';

/**
 * Resolves and downloads URIs from devfile components following the same logic
 * as the devfile/library Go implementation.
 *
 * @see https://github.com/devfile/library/blob/main/pkg/devfile/parser/parse.go#L847-L890
 */
export class DevfileUriResolver {
    /**
     * Resolves a URI from a devfile component (kubernetes.uri, dockerfile.uri, etc.)
     *
     * Resolution logic (matching devfile/library Go implementation):
     * 1. If URI is absolute HTTP(S) URL → return as-is
     * 2. If URI is relative and devfileAbsPath exists → resolve relative to devfile directory
     * 3. If URI is relative and devfileSourceUrl exists → resolve relative to source URL
     * 4. Otherwise → throw error
     *
     * @param uri - The URI to resolve (from kubernetes.uri, dockerfile.uri, etc.)
     * @param devfileSourceUrl - Optional URL where the devfile was fetched from (e.g., "https://registry.devfile.io/devfiles/go/2.6.0")
     * @param devfileAbsPath - Optional absolute path to the devfile on disk
     * @returns Resolved absolute URI (URL or file path)
     */
    public static resolveUri(
        uri: string,
        devfileSourceUrl?: string,
        devfileAbsPath?: string
    ): string {
        const absoluteURL = uri.startsWith('http://') || uri.startsWith('https://');

        // Case 1: Absolute HTTP(S) URL - return as-is
        if (absoluteURL) {
            return uri;
        }

        // Case 2: Relative path on disk
        // Use posix paths for devfile URIs (always forward slashes, even on Windows)
        if (devfileAbsPath) {
            const devfileDir = path.dirname(devfileAbsPath).replace(/\\/g, '/');
            return path.posix.join(devfileDir, uri);
        }

        // Case 3: Relative path to a URL (resolve against registry endpoint)
        if (devfileSourceUrl) {
            // Normalize: remove trailing slash from devfileSourceUrl for consistent joining
            const normalizedBase = devfileSourceUrl.endsWith('/')
                ? devfileSourceUrl.slice(0, -1)
                : devfileSourceUrl;

            // Simple concatenation with slash separator
            return `${normalizedBase}/${uri}`;
        }

        throw new Error(
            `Cannot resolve URI '${uri}': no devfile source context available. ` +
            'Provide either devfileSourceUrl or devfileAbsPath.'
        );
    }

    /**
     * Downloads content from a resolved URI.
     *
     * @param resolvedUri - Absolute URI (URL or file path) returned by resolveUri()
     * @param retries - Number of retry attempts for HTTP 429 responses (default: 3)
     * @returns Content as string
     * @throws Error if file doesn't exist, is not readable, or contains non-text content
     */
    public static async downloadContent(resolvedUri: string, retries = 3): Promise<string> {
        if (resolvedUri.startsWith('http://') || resolvedUri.startsWith('https://')) {
            return this.downloadWithRetry(resolvedUri, retries);
        }

        // Local file - must exist and be text
        try {
            const content = await fs.readFile(resolvedUri, 'utf-8');

            // Validate that content is actually text (not binary)
            // Check for null bytes which indicate binary content
            if (content.includes('\0')) {
                throw new Error(
                    `File '${resolvedUri}' appears to be binary (contains null bytes). ` +
                    'Only text files can be inlined into devfiles.'
                );
            }

            return content;
        } catch (err) {
            // Re-throw validation errors as-is
            if (err.message?.includes('appears to be binary')) {
                throw err;
            }

            // Improve error message for common cases
            if (err.code === 'ENOENT') {
                throw new Error(`File not found: '${resolvedUri}'`);
            }

            if (err.code === 'EACCES') {
                throw new Error(`Permission denied reading file: '${resolvedUri}'`);
            }

            throw new Error(`Failed to read file '${resolvedUri}': ${err.message}`);
        }
    }

    /**
     * Downloads HTTP(S) content with exponential backoff retry for 429 (rate limit) responses.
     */
    private static async downloadWithRetry(url: string, maxRetries: number): Promise<string> {
        let lastError: Error;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await got(url, {
                    timeout: {
                        request: 10000, // 10 second timeout
                    },
                });
                return response.body;
            } catch (err) {
                lastError = err;

                // Retry on 429 (Too Many Requests)
                if (err.response?.statusCode === 429 && attempt < maxRetries - 1) {
                    const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                    await this.sleep(backoffMs);
                    continue;
                }

                // Don't retry other errors
                break;
            }
        }

        throw new Error(`Failed to download from '${url}': ${lastError.message}`);
    }

    private static sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
