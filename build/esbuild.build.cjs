const { execSync } = require('child_process');
const esbuild = require('esbuild');
const { esmAliasPlugin, esbuildProblemMatcherPlugin, nativeNodeModulesPlugin, svgrPlugin } = require('./esbuild.plugins.cjs');
const { webviews, srcDir, outDir } = require('./esbuild.settings.cjs');
const { sassPlugin } = require('esbuild-sass-plugin');
const { cp, mkdir, readFile, stat } = require('node:fs/promises');
const path = require('path');
const { sync } = require('fast-glob');


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

// Verify the WebViews
try {
    execSync('tsc --noEmit -p ./src/webview/tsconfig.json', { stdio: 'inherit' });
} catch (err) {
    console.error('❌ TypeScript type-checking failed.');
    process.exit(1);
}


console.log(`esbuild: building for production: ${production ? 'Yes' : 'No'}`);

const baseConfig = {
    bundle: production,
    target: 'chrome108',
    minify: production,
    sourcemap: !production,
    logLevel: 'warning',
};

async function build() {
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

        // Build the Webviews
        const webviewsConfig = {
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
        await esbuild.build(webviewsConfig);
        console.log('✅ Webview build completed');
    } else {
        // Build the Extension for development
        const srcFiles = sync(`${srcDir}/**/*.{js,ts,tsx}`, { absolute: false });
        const devExtConfig = {
            ...baseConfig,
            platform: 'node',
            format: 'cjs',
            entryPoints: srcFiles.map(f => `./${f}`),
            outbase: srcDir,
            outdir: `${outDir}/${srcDir}`,
            // external: [ 'vscode', 'shelljs', 'jsonc-parser' ],
            plugins: [
                esmAliasPlugin(),
                nativeNodeModulesPlugin(),
                esbuildProblemMatcherPlugin(production) // this one is to be added to the end of plugins array
            ]
        };

        await esbuild.build(devExtConfig);
        console.log('✅ Extension build completed');

        const jsonFiles = sync('src/**/*.json', { absolute: false });
        for (const file of jsonFiles) {
            const dest = path.join('out', file);
            await cp(file, dest, { recursive: false, force: true });
        }
        await cp('package.json', 'out/package.json');

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
        await esbuild.build(devWebViewConfig);
        console.log('✅ Webview build completed');

        // Match everything under test/, not just *.test.ts
        const testFiles = sync('test/**/*.{ts,tsx}', { absolute: true });
        const testConfig = {
            ...baseConfig,
            entryPoints: testFiles,
            outdir: `${outDir}/test`,
            outbase: 'test',             // preserves folder structure
            platform: 'node',
            format: 'cjs',               // CommonJS for Node
            sourcemap: true,
            // target: 'es2022',
            plugins: [
                esmAliasPlugin()
            ]
        }
        await esbuild.build(testConfig);
        console.log('✅ Tests build completed');
    }

    async function dirExists(path) {
        try {
            if ((await stat(path)).isDirectory()) return true;
        } catch { /* Ignore */ }
        return false;
    }

    // Copy webview's 'index.html's to the output webview dirs
    await Promise.all([
        ...webviews.map(async webview => {
            const targetDir = path.join(__dirname, '..', `${outDir}/${webview}/app`);
            if (!dirExists(targetDir)) {
                await mkdir(targetDir, { recursive: true, mode: 0o750} );
            }
            sync(path.resolve(__dirname, '..', `${srcDir}/webview/${webview}/app/index.html`)).map(async srcFile => {
                await cp(srcFile, path.join(targetDir, `${path.basename(srcFile)}`));
            });
        })
    ]);
}

build().catch(err => {
    console.error('❌ Build failed:', err);
    process.exit(1);
});