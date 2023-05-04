/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */

import { watch } from 'chokidar';
import * as esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';
import * as fs from 'node:fs/promises';
import process from 'node:process';
import * as cp from 'node:child_process';
import svgr from 'esbuild-plugin-svgr';

// This script runs tsc and esbuild in parallel when there are filesystem changes.
// It outputs predictable markers for the beginning and ending of the compilation,
// so that it can be integrated into

// Note that TypeScript is run synchronously,
// since integrating TypeScript's watch mode into this script is very difficult

// represents the timeout between the last filesystem change and the recompilation,
// in order to reduce the number of times the build is run
let timeout = undefined;

const webviews = (await fs.readdir('./src/webview', { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory() && !['@types', 'common', 'common-ext'].includes(dirent.name))
    .map((dirent) => dirent.name);

function kebabToCamel(text) {
    return text.replace(/-./g, (searchResult) => searchResult.substring(1).toUpperCase());
}

// build the esbuild contexts
const contexts = [];
await Promise.all(
    webviews.map(async (webview) => {
        const ctx = await esbuild.context({
            entryPoints: [`./src/webview/${webview}/app/index.tsx`],
            bundle: true,
            outfile: `./out/${kebabToCamel(webview)}Viewer/index.js`,
            platform: 'browser',
            target: 'chrome108',
            sourcemap: true,
            loader: {
                '.png': 'file',
                '.svg': 'file',
            },
            plugins: [
                sassPlugin(),
                svgr({
                    plugins: ['@svgr/plugin-jsx']
                }),
            ],
        });
        contexts.push(ctx);
    }),
);

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
            ...contexts.map((context) => context.rebuild()),
            ...webviews.map((webview) => fs.cp(
                `./src/webview/${webview}/app/index.html`,
                `./out/${kebabToCamel(webview)}Viewer/index.html`)),
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
    contexts.forEach((ctx) => void ctx.dispose());
});

process.on('exit', () => {
    console.log('Watch mode stopped');
});