/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

const { execSync } = require('child_process');
const esbuild = require('esbuild');
const { esmAliasPlugin, esbuildProblemMatcherPlugin, nativeNodeModulesPlugin } = require('./esbuild.plugins.cjs');
const { srcDir, outDir } = require('./esbuild.settings.cjs');
const { cp } = require('node:fs/promises');
const path = require('path');
const { sync } = require('fast-glob');

const production = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

// eslint-disable no-console

const baseConfig = {
    bundle: true,
    target: 'chrome108',
    minify: production,
    sourcemap: !production,
    logLevel: 'warning',
    logOverride: {
        'equals-negative-zero': 'silent'
    }
};

async function copyJsonFiles() {
    const jsonFiles = sync('src/**/*.json', { absolute: false });
    for (const file of jsonFiles) {
        const dest = path.join('out', file);
        await cp(file, dest, { recursive: false, force: true });
    }
    await cp('package.json', 'out/package.json');
}

async function buildExtension() {
    // Only run type-checking on non-watch builds
    if (!isWatch) {
        console.log('🔍 Running TypeScript type-checking...');
        try {
            execSync('tsc --noEmit -p tsconfig.json', { stdio: 'inherit' });
        } catch (err) {
            console.error('❌ TypeScript type-checking failed.');
            process.exit(1);
        }
    }

    console.log(`📦 Building the extension for ${production ? 'Production' : 'Development'}...`);

    if (production) {
        // Build the extension.js (single bundle for production)
        const extConfig = {
            ...baseConfig,
            platform: 'node',
            format: 'cjs',
            entryPoints: [`./${srcDir}/extension.ts`],
            outfile: `${outDir}/${srcDir}/extension.js`,
            external: ['vscode', 'shelljs', 'jsonc-parser'],
            plugins: [
                nativeNodeModulesPlugin(),
                esbuildProblemMatcherPlugin(production)
            ]
        };
        await esbuild.build(extConfig);
        await copyJsonFiles();
        console.log('✅ Extension build completed');
    } else {
        // Build the Extension for development (individual files)
        const srcFiles = sync(`${srcDir}/**/*.{js,ts}`, { absolute: false });
        const devExtConfig = {
            ...baseConfig,
            platform: 'node',
            format: 'cjs',
            entryPoints: srcFiles.map(f => `./${f}`),
            outbase: srcDir,
            outdir: `${outDir}/${srcDir}`,
            external: ['vscode', 'shelljs', 'jsonc-parser', '@aws-sdk/client-s3'],
            plugins: [
                esmAliasPlugin(),
                nativeNodeModulesPlugin(),
                esbuildProblemMatcherPlugin(production)
            ]
        };

        if (isWatch) {
            try {
                const ctx = await esbuild.context({
                    ...devExtConfig,
                    plugins: [
                        ...devExtConfig.plugins,
                        {
                            name: 'rebuild-hook',
                            setup(build) {
                                build.onEnd(result => {
                                    if (result.errors.length === 0) {
                                        console.log('🔁 Extension rebuild succeeded');
                                        copyJsonFiles().catch(err =>
                                            console.error('❌ Failed to copy JSON files after rebuild:', err)
                                        );
                                    } else {
                                        console.error('❌ Extension rebuild errors:', result.errors);
                                    }
                                });
                            }
                        }
                    ]
                });
                await ctx.watch();
                await copyJsonFiles().catch(err => {
                    console.error('❌ Failed to copy JSON files on initial watch setup:', err);
                });
                console.log('👀 Watching the extension...');

                // Keep the process alive even if there are errors
                // esbuild will continue watching and rebuild on changes
                await new Promise(() => {}); // Never resolves - keeps watch running
            } catch (err) {
                console.error('❌ Failed to start extension watcher:', err);
                console.error('⚠️  Watch mode failed to start. Please fix errors and restart.');
                process.exit(1);
            }
        } else {
            await esbuild.build(devExtConfig);
            await copyJsonFiles();
            console.log('✅ Extension build completed');
        }
    }
}

if (require.main === module) {
    buildExtension().catch(err => {
        console.error('❌ Extension build failed:', err);
        process.exit(1);
    });
}

module.exports = { buildExtension };
