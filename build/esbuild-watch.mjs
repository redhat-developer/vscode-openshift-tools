/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */

import { transform } from '@svgr/core';
import { watch } from 'chokidar';
import * as esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';
import * as cp from 'node:child_process';
import { cp as copyFile, readdir, readFile } from 'node:fs/promises';
import process from 'node:process';

// This script runs tsc and esbuild in parallel when there are filesystem changes.
// It outputs predictable markers for the beginning and ending of the compilation,
// so that it can be integrated into

// Note that TypeScript is run synchronously,
// since integrating TypeScript's watch mode into this script is very difficult

// represents the timeout between the last filesystem change and the recompilation,
// in order to reduce the number of times the build is run
let timeout = undefined;

const webviews = (await readdir('./src/webview', { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory() && !['@types', 'common', 'common-ext'].includes(dirent.name))
    .map((dirent) => dirent.name);

// The following 'svgrPlugin' const have been stolen from 'esbuild-plugin-scgr' due to lack of support of the latest 'esbuild' versions
// by the plugin itself.
// See: https://github.com/kazijawad/esbuild-plugin-svgr/issues/20
//
const svgrPlugin = (options = {
    markExternal: true
}) => ({
    name: 'svgr',
    setup(build) {
        build.onResolve({ filter: /\.svg$/ }, async (args) => {
            switch (args.kind) {
                case 'import-statement':
                case 'require-call':
                case 'dynamic-import':
                case 'require-resolve':
                    return
                default:
                    if (options.markExternal) {
                        return {
                            external: true,
                        }
                    }
            }
        })

        build.onLoad({ filter: /\.svg$/ }, async (args) => {
            const svg = await readFile(args.path, { encoding: 'utf8' })

            if (options.plugins && !options.plugins.includes('@svgr/plugin-jsx')) {
                options.plugins.push('@svgr/plugin-jsx')
            } else if (!options.plugins) {
                options.plugins = ['@svgr/plugin-jsx']
            }

            const contents = await transform(svg, { ...options }, { filePath: args.path })

            if (args.suffix === '?url') {
                return {
                    contents: args.path,
                    loader: 'text',
                }
            }

            return {
                contents,
                loader: options.typescript ? 'tsx' : 'jsx',
            }
        })
    },
});

// build the esbuild contexts
const esbuildContext = await esbuild.context({
    entryPoints: webviews.map(webview => `./src/webview/${webview}/app/index.tsx`),
    bundle: true,
    outdir: 'out',
    platform: 'browser',
    target: 'chrome108',
    sourcemap: true,
    loader: {
        '.png': 'file',
        '.svg': 'file',
    },
    plugins: [
        sassPlugin(),
        svgrPlugin({ plugins: ['@svgr/plugin-jsx'] }),
    ],
});

/**
 * Returns a timestamp that imitates the one used by tsc watch
 *
 * @returns a timestamp that imitates the one used by tsc watch
 */
function getTimestamp() {
    return new Date().toLocaleTimeString();
}

function promiseExec(cmd) {
    return new Promise((resolve, reject) => {
        const child = cp.exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject();
                return;
            }
            resolve();
        });
        child.stdout.on('data', (data) => {
            console.log(data);
        });
        child.stderr.on('data', (data) => {
            console.error(data);
        });
    });
}

async function runBuildProcess() {
    let success = true;
    try {
        await Promise.all([
            promiseExec('npx tsc -p ./'),
            promiseExec('npx tsc -p ./src/webview -noEmit'),
            esbuildContext.rebuild(),
            ...webviews.map((webview) => copyFile(
                `./src/webview/${webview}/app/index.html`,
                `./out/${webview}/app/index.html`)),
        ]);
    } catch (error) {
        success = false;
    }
    console.log(`[${getTimestamp(0)}] Compilation complete. Found ${success ? 'no' : 'some'} errors. Watching for file changes.`);
}

function runWatchBuildProcess() {
    console.log(`[${getTimestamp()}] File change detected. Compiling...`);
    clearTimeout(runWatchBuildProcess);
    void runBuildProcess();
}

const watcher = watch('./src').on('all', (event, path) => {
    // wait for a half second after the last filesystem change before compiling,
    // in order to debounce filesystem changes and prevent compiling too often
    if (timeout) {
        clearTimeout(timeout);
    }
    timeout = setTimeout(runWatchBuildProcess, 500);
});

process.on('SIGINT', () => {
    console.log('Stopping watch mode...')
    watcher.close();
    esbuildContext.dispose();
});

process.on('exit', () => {
    console.log('Watch mode stopped');
});
