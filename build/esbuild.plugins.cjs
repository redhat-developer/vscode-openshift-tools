/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

const { transform } = require('@svgr/core');
const { dirname } = require('path');
const { readFile } = require('node:fs/promises');
const { esmImportTargets } = require('./esbuild.settings.cjs');
const path = require('path');

// Helper to escape special chars in module names (e.g. '@')
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// aliases argument is expected to ba an array of objects like `{ name: string, entry: string, outfile: string }`
function esmAliasPlugin() {
    return {
        name: 'esm-alias-plugin',
        setup(build) {
            // One matcher for all targets
            const filter = new RegExp(`^(${Object.keys(esmImportTargets).map(escapeRegExp).join('|')})$`);

            build.onResolve({ filter }, args => {
                const target = esmImportTargets[args.path];
                const absPath = path.resolve(__dirname, '..', target.outfile);

                console.log(`[esm-alias-plugin] Replacing "${args.path}" with "${absPath}"`);
                return {
                    path: absPath,
                    namespace: 'file'
                };
            });
        }
    };
}

/**
 * @type {import('esbuild').Plugin}
 */
function esbuildProblemMatcherPlugin(production) {
    return {
        name: 'esbuild-problem-matcher',
        setup(build) {
            build.onEnd(result => {
                result.errors.forEach(({ text, location }) => {
                    console.error(`✘ [ERROR] ${text}`);
                    if (location) {
                        console.error(`    ${location.file}:${location.line}:${location.column}:`);
                    }
                });
            });
        }
    };
}

function nativeNodeModulesPlugin() {
    return {
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
                        resolveDir: dirname(args.path),
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
                console.error(`[native-node-modules] ERROR: ${err}`);
            }
        }
    };
}

// The following 'svgrPlugin' const have been stolen from 'esbuild-plugin-scgr' due to lack of support of the latest 'esbuild' versions
// by the plugin itself.
// See: https://github.com/kazijawad/esbuild-plugin-svgr/issues/20
//
function svgrPlugin(options = { markExternal: true }) {
    return {
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
        }
    };
}

function verbosePlugin() {
    return {
        name: 'verbose',
        setup(build) {
            build.onLoad({ filter: /.*/ }, async (args) => {
                console.log(`[esbuild] Loading: ${args.path}`);
                return null; // let esbuild handle the actual load
            });
        }
    };
}

module.exports = {
    esmAliasPlugin,
    esbuildProblemMatcherPlugin,
    nativeNodeModulesPlugin,
    svgrPlugin,
    verbosePlugin
};