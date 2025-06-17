const { transform } = require('@svgr/core');
const { dirname, resolve } = require('path');
const { cp, mkdir, readFile, stat } = require('node:fs/promises');
const { filter } = require('lodash');
const { esmImportTargets } = require('./esbuild.settings.cjs');


// const { createRequire } = require('module');

// const require = createRequire(import.meta.url);

// aliases argument is expected to ba an array of objects like `{ name: string, entry: string, outfile: string }`
function esmAliasPlugin() {
    return {
        name: 'esm-alias-plugin',
        setup(build) {
            // const esmImportTargets = {
            //     got: require.resolve('./out/esm/got.cjs'),
            //     '@kubernetes/client-node': require.resolve('./out/esm/k8s-client-node.cjs')
            // };

            // Catch ALL module resolution attempts
            build.onResolve({ filter: /.*/ }, args => {
                // console.log(`[onResolve] ${args.path} from ${args.importer}`);
                const entry = esmImportTargets[args.path];
                if (entry && entry.outfile) {
                    console.log(`Resolving: ${args.path} from ${args.importer} ==>> ${require.resolve(resolve(__dirname, '..', entry.outfile))}`)
                    return { path: require.resolve(resolve(__dirname, '..', entry.outfile)) };
                }
            });
        }
    };
}

function detectGoal(production, entryPoints) {
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
function esbuildProblemMatcherPlugin(production) {
    return {
        name: 'esbuild-problem-matcher',
        setup(build) {
            build.onStart(() => {
                const goal = detectGoal(production, build.initialOptions.entryPoints);
                console.log(`[watch] build started${goal ? ' for ' + goal : ''}...` );
            });

            build.onEnd(result => {
                result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                if (location) {
                    console.error(`    ${location.file}:${location.line}:${location.column}:`);
                }
                });
                const goal = detectGoal(production, build.initialOptions.entryPoints);
                console.log(`[watch] build finished${goal ? ' for ' + goal : ''}`);
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
                console.error(`native-node-modules: ERROR: ${err}`);
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

module.exports = {
    esmAliasPlugin,
    esbuildProblemMatcherPlugin,
    nativeNodeModulesPlugin,
    svgrPlugin
};