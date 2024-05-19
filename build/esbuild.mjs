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
    'create-route',
    'create-component',
    'devfile-registry',
    'helm-chart',
    'helm-manage-repository',
    'welcome',
    'feedback',
    'serverless-function',
    'serverless-manage-repository',
    'add-service-binding',
    'openshift-terminal',
];

await Promise.all([
    esbuild.build({
        entryPoints: webviews.map(webview => `./src/webview/${webview}/app/index.tsx`),
        bundle: true,
        outdir: 'out',
        platform: 'browser',
        target: 'chrome108',
        sourcemap: true,
        loader: {
            '.png': 'file',
        },
        plugins: [
            sassPlugin(),
            svgr({
                plugins: ['@svgr/plugin-jsx']
            }),
        ]
    }),
    ...webviews.map(webview =>
        fs.cp(`./src/webview/${webview}/app/index.html`, `./out/${webview}/app/index.html`)
    ),
]);
