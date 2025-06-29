/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { transform } from '@svgr/core';
import * as esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';
import fglob from 'fast-glob';
import { createRequire } from 'module';
import { cp, mkdir, readFile, stat } from 'node:fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);

const webviews = [
    'cluster',
    'create-service',
    'create-route',
    'create-component',
    'create-deployment',
    'devfile-registry',
    'helm-chart',
    'helm-manage-repository',
    'invoke-serverless-function',
    'welcome',
    'feedback',
    'serverless-function',
    'serverless-manage-repository',
    'openshift-terminal',
];

const production = process.argv.includes('--production');

// eslint-disable no-console
console.log(`esbuild: building for production: ${production ? 'Yes' : 'No'}`);

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.resolve(path.dirname(__filename), '..'); // get the name of the directory
const srcDir = 'src'; // Input source directory
const outDir = 'out'; // Output dist directory

function detectGoal(entryPoints) {
    if (production) {
        const isExtension = entryPoints.filter((ep) => `${ep}`.includes('extension.ts')).length > 0;
        const isWebviews = entryPoints.filter((ep) => `${ep}`.includes('.tsx')).length > 0;
        return isExtension ? 'Extension' :  isWebviews ? 'the Webviews' : '';
    }
    return 'Extension and the Webviews for testing/debugging';
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',

    setup(build) {
      build.onStart(() => {
        const goal = detectGoal(build.initialOptions.entryPoints);
        console.log(`[watch] build started${goal ? ' for ' + goal : ''}...` );
      });
      build.onEnd(result => {
        result.errors.forEach(({ text, location }) => {
          console.error(`✘ [ERROR] ${text}`);
          if (location) {
            console.error(`    ${location.file}:${location.line}:${location.column}:`);
          }
        });
        const goal = detectGoal(build.initialOptions.entryPoints);
        console.log(`[watch] build finished${goal ? ' for ' + goal : ''}`);
      });
    }
  };

const nativeNodeModulesPlugin = {
    name: 'native-node-modules',
    setup(build) {
        try {
            // If a ".node" file is imported within a module in the "file" namespace, resolve
            // it to an absolute path and put it into the "node-file" virtual namespace.
            build.onResolve({ filter: /\.node$/, namespace: 'file' }, args => {
                const resolvedId = require.resolve(args.path, { paths: [args.resolveDir] });
                if (resolvedId.endsWith('.node')) {
                    return { path: resolvedId, namespace: 'node-file' };
                }
                return { path: resolvedId };
            });

            // Files in the "node-file" virtual namespace call "require()" on the
            // path from esbuild of the ".node" file in the output directory.
            build.onLoad({ filter: /.*/, namespace: 'node-file' }, args => {
                return {
                    contents: `
                        import path from ${JSON.stringify(args.path)}
                        try { module.exports = require(path) }
                        catch {}
                    `,
                    resolveDir: path.dirname(args.path),
                };
            });

            // If a ".node" file is imported within a module in the "node-file" namespace, put
            // it in the "file" namespace where esbuild's default loading behavior will handle
            // it. It is already an absolute path since we resolved it to one above.
            build.onResolve({ filter: /\.node$/, namespace: 'node-file' }, args => ({
                path: args.path,
                namespace: 'file',
            }));

            // Tell esbuild's default loading behavior to use the "file" loader for
            // these ".node" files.
            let opts = build.initialOptions
            opts.loader = opts.loader || {}
            opts.loader['.node'] = 'file'
        } catch (err) {
            console.error(`native-node-modules: ERROR: ${err}`);
        }
    },
};

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

const baseConfig = {
    bundle: true,
    target: 'chrome108',
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    logLevel: 'warning',
};

if (production) {
    // Build the extension.js
    const extConfig = {
        ...baseConfig,
        platform: 'node',
        entryPoints: [`./${srcDir}/extension.ts`],
        outfile: `${outDir}/${srcDir}/extension.js`,
        external: [ 'vscode', 'shelljs', 'jsonc-parser' ],
        plugins: [
            nativeNodeModulesPlugin,
            esbuildProblemMatcherPlugin // this one is to be added to the end of plugins array
        ]
    };
    await esbuild.build(extConfig);

    // Build the Webviews
    const webviewsConfig = {
        ...baseConfig,
        platform: 'browser',
        entryPoints: [...webviews.map(webview => `./${srcDir}/webview/${webview}/app/index.tsx`)],
        outdir: `${outDir}`,
        loader: {
            '.png': 'file',
        },
        plugins: [
            sassPlugin(),
            svgrPlugin({ plugins: ['@svgr/plugin-jsx'] }),
            esbuildProblemMatcherPlugin // this one is to be added to the end of plugins array
        ]
    };
    await esbuild.build(webviewsConfig);
} else {
    // Build the Webviews
    const devConfig = {
        ...baseConfig,
        platform: 'browser',
        entryPoints: [...webviews.map(webview => `./${srcDir}/webview/${webview}/app/index.tsx`)],
        outdir: `${outDir}`,
        loader: {
            '.png': 'file',
        },
        plugins: [
            sassPlugin(),
            svgrPlugin({ plugins: ['@svgr/plugin-jsx'] }),
            esbuildProblemMatcherPlugin // this one is to be added to the end of plugins array
        ]
    };
    await esbuild.build(devConfig);
}

async function dirExists(path) {
    try {
        if ((await stat(path)).isDirectory()) {
            return true;
        }
    } catch {
        // Ignore
    }
    return false;
}

// Copy webview's 'index.html's to the output webview dirs
await Promise.all([
    ...webviews.map(async webview => {
        const targetDir = path.join(__dirname, `${outDir}/${webview}/app`);
        if (!dirExists(targetDir)) {
            await mkdir(targetDir, { recursive: true, mode: 0o750} );
        }
        fglob.sync([ `${srcDir}/webview/${webview}/app/index.html` ]).map(async srcFile => {
            await cp(path.join(__dirname, srcFile), path.join(targetDir, `${path.basename(srcFile)}`))
        });
    })
]);
