/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as esbuild from 'esbuild';
import svgr from 'esbuild-plugin-svgr';
import { sassPlugin } from 'esbuild-sass-plugin';
import * as fs from 'fs/promises';

const webviews = [
    'cluster',
    'create-service',
    'create-component',
    'describe',
    'devfile-registry',
    'helm-chart',
    'log',
    'welcome',
    'feedback',
    'serverless-function',
    'add-service-binding',
];

function kebabToCamel(text) {
    return text.replace(/-./g, searchResult => searchResult.substring(1).toUpperCase());
}

await Promise.all([
    ...webviews.map(webview =>
        esbuild.build({
            entryPoints: [
                `./src/webview/${webview}/app/index.tsx`,
            ],
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
            ]
        })
    ),
    ...webviews.map(webview =>
        fs.cp(`./src/webview/${webview}/app/index.html`, `./out/${kebabToCamel(webview)}Viewer/index.html`)
    ),
]);
