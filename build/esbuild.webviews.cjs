/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

const { execSync } = require('child_process');
const esbuild = require('esbuild');
const { esbuildProblemMatcherPlugin, svgrPlugin } = require('./esbuild.plugins.cjs');
const { webviews, srcDir, outDir } = require('./esbuild.settings.cjs');
const { sassPlugin } = require('esbuild-sass-plugin');
const { cp, mkdir, stat } = require('node:fs/promises');
const path = require('path');
const { sync } = require('fast-glob');

const production = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

// eslint-disable no-console

// Verify the WebViews (skip in watch mode - VS Code editor handles this)
if (!isWatch) {
    try {
        execSync('tsc --noEmit -p ./src/webview/tsconfig.json', { stdio: 'inherit' });
    } catch (err) {
        console.error('❌ TypeScript type-checking failed.');
        process.exit(1);
    }
}

const baseConfig = {
    bundle: true,
    target: 'chrome108',
    minify: production,
    sourcemap: !production,
    logLevel: 'warning',
};

async function buildWebviews() {
    console.log('📦 Building the webviews...');

    const devWebViewConfig = {
        ...baseConfig,
        platform: 'browser',
        format: 'esm',
        entryPoints: [...webviews.map(webview => `./${srcDir}/webview/${webview}/app/index.tsx`)],
        outdir: `${outDir}`,
        loader: {
            '.png': 'file',
        },
        plugins: [
            sassPlugin(),
            svgrPlugin({ plugins: ['@svgr/plugin-jsx'] }),
            esbuildProblemMatcherPlugin(production) // this one is to be added to the end of plugins array
        ]
    };

    if (isWatch) {
        try {
            const ctx = await esbuild.context({
                ...devWebViewConfig,
                plugins: [
                    ...devWebViewConfig.plugins,
                    {
                        name: 'rebuild-hook',
                        setup(build) {
                            build.onEnd(result => {
                                if (result.errors.length === 0) {
                                    console.log('🔁 Rebuild succeeded');
                                    copyHtmlFiles().catch(err =>
                                        console.error('❌ Failed to copy HTML files after rebuild:', err)
                                    );
                                } else {
                                    console.error('❌ Rebuild errors:', result.errors);
                                }
                            });
                        }
                    }
                ]
            });
            await ctx.watch();
            await copyHtmlFiles().catch(err => {
                console.error('❌ Failed to copy HTML files on initial watch setup:', err);
            });
            console.log('👀 Watching the webviews...');

            // Keep the process alive even if there are errors
            // esbuild will continue watching and rebuild on changes
            await new Promise(() => {}); // Never resolves - keeps watch running
        } catch (err) {
            console.error('❌ Failed to start webviews watcher:', err);
            console.error('⚠️  Watch mode failed to start. Please fix errors and restart.');
            process.exit(1);
        }
    } else {
        await esbuild.build(devWebViewConfig);
        await copyHtmlFiles();
        console.log('✅ Webview build completed');
    }
}

async function copyHtmlFiles() {
    await Promise.all(
        webviews.map(async webview => {
            const targetDir = path.join(__dirname, '..', `${outDir}/${webview}/app`);
            if (!await dirExists(targetDir)) {
                await mkdir(targetDir, { recursive: true, mode: 0o750 });
            }

            const pattern = path
                .join(srcDir, 'webview', webview, 'app', 'index.html')
                .replace(/\\/g, '/');

            const htmlFiles = sync(pattern, {
                cwd: path.resolve(__dirname, '..'),
                absolute: true,
            });

            await Promise.all(
                htmlFiles.map(async srcFile => {
                    await cp(srcFile, path.join(targetDir, path.basename(srcFile)));
                })
            );
        })
    );
}

async function dirExists(path) {
    try {
        if ((await stat(path)).isDirectory()) return true;
    } catch { /* Ignore */ }
    return false;
}

if (require.main === module) {
    buildWebviews().catch(err => {
        console.error('❌ Build failed:', err);
        process.exit(1);
    });
}

module.exports = { buildWebviews };