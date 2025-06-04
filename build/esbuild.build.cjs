/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

const { execSync } = require('child_process');
const esbuild = require('esbuild');
const { esmAliasPlugin, esbuildProblemMatcherPlugin, nativeNodeModulesPlugin, svgrPlugin, verbosePlugin } = require('./esbuild.plugins.cjs');
const { webviews, srcDir, outDir } = require('./esbuild.settings.cjs');
const { sassPlugin } = require('esbuild-sass-plugin');
const { cp, mkdir, stat } = require('node:fs/promises');
const path = require('path');
const { sync } = require('fast-glob');
const { buildWebviews } = require('./esbuild.webviews.cjs');

const production = process.argv.includes('--production');

// eslint-disable no-console

// Run type-checking

/// Verify the extension
try {
    // execSync('tsc --noEmit', { stdio: 'inherit' });
    execSync('tsc --noEmit -p tsconfig.json', { stdio: 'inherit' });
} catch (err) {
    console.error('❌ TypeScript type-checking failed.');
    process.exit(1);
}

console.log(`esbuild: building for production: ${production ? 'Yes' : 'No'}`);

const baseConfig = {
    bundle: true,
    target: 'chrome108',
    minify: production,
    sourcemap: !production,
    logLevel: 'warning',
};

async function buildExtension() {
    console.log(`📦 Building the extension for ${ production ? 'Production' : 'Development'}...`);

    if (production) {
        // Build the extension.js
        const extConfig = {
            ...baseConfig,
            platform: 'node',
            format: 'cjs',
            entryPoints: [`./${srcDir}/extension.ts`],
            outfile: `${outDir}/${srcDir}/extension.js`,
            external: [ 'vscode', 'shelljs', 'jsonc-parser' ],
            plugins: [
                nativeNodeModulesPlugin(),
                esbuildProblemMatcherPlugin(production) // this one is to be added to the end of plugins array
            ]
        };
        await esbuild.build(extConfig);
        console.log('✅ Extension build completed');
    } else {
        // Build the Extension for development
        const srcFiles = sync(`${srcDir}/**/*.{js,ts}`, { absolute: false });
        const devExtConfig = {
            ...baseConfig,
            platform: 'node',
            format: 'cjs',
            entryPoints: srcFiles.map(f => `./${f}`),
            outbase: srcDir,
            outdir: `${outDir}/${srcDir}`,
            external: [ 'vscode', 'shelljs', 'jsonc-parser', '@aws-sdk/client-s3' ],
            plugins: [
                // verbosePlugin(),
                esmAliasPlugin(),
                nativeNodeModulesPlugin(),
                esbuildProblemMatcherPlugin(production) // this one is to be added to the end of plugins array
            ]
        };

        await esbuild.build(devExtConfig);

        const jsonFiles = sync('src/**/*.json', { absolute: false });
        for (const file of jsonFiles) {
            const dest = path.join('out', file);
            await cp(file, dest, { recursive: false, force: true });
        }
        await cp('package.json', 'out/package.json');
        console.log('✅ Extension build completed');
    }
}

async function buildAll() {
  await buildExtension();
  await buildWebviews();
}

buildAll().catch(err => {
    console.error('❌ Build failed:', err);
    process.exit(1);
});