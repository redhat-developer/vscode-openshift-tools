// esbuild.watch.cjs
const esbuild = require('esbuild');
const { targets, webviews, srcDir, outDir } = require('./esbuild.settings.cjs');
const { esmAliasPlugin, esbuildProblemMatcherPlugin, nativeNodeModulesPlugin, svgrPlugin } = require('./esbuild.plugins.cjs');
const { sassPlugin } = require('esbuild-sass-plugin');

const baseConfig = {
    bundle: true,
    target: 'chrome108',
    format: 'cjs',
    minify: false,
    sourcemap: true,
    logLevel: 'debug',
};

const devExtConfig = {
    ...baseConfig,
    platform: 'node',
    entryPoints: [`./${srcDir}/extension.ts`],
    outfile: `${outDir}/${srcDir}/extension.js`,
    external: [ 'vscode', 'shelljs', 'jsonc-parser' ],
    plugins: [
        esmAliasPlugin(targets),
        nativeNodeModulesPlugin(),
        // esbuildProblemMatcherPlugin(false) // this one is to be added to the end of plugins array
    ]
};
    // build(devExtConfig).catch((err) => {
    //     console.error('❌ Failed to transform ESM dependencies:', err);
    //     process.exit(1);
    // });


    // Build the Webviews for development
//         entryPoints: ['./src/webview/main.ts'], // +
//         outfile: './out/webview/main.js',       // +
//         bundle: true,                           // +
//         minify: isProduction,                   // +
//         sourcemap: !isProduction,               // +
//         platform: 'browser',                    // +
//         target: 'es2020',                       // 'chrome108'
const devWebViewConfig = {
    ...baseConfig,
    platform: 'browser',
    entryPoints: [...webviews.map(webview => `./${srcDir}/webview/${webview}/app/index.tsx`)],
    outdir: `${outDir}`,
    loader: {
        '.png': 'file',
    },
    plugins: [
        esmAliasPlugin(targets, 'browser'),
        sassPlugin(),
        svgrPlugin({ plugins: ['@svgr/plugin-jsx'] }),
        // esbuildProblemMatcherPlugin(false) // this one is to be added to the end of plugins array
    ]
};

    // build(devWebViewConfig).catch((err) => {
    //     console.error('❌ Failed to transform ESM dependencies:', err);
    //     process.exit(1);
    // });


//
// const buildExtension = {
//   entryPoints: ['src/extension.ts'],
//   bundle: true,
//   platform: 'node',
//   target: 'node18',
//   outfile: 'out/extension.js',
//   sourcemap: true,
//   watch: isWatch && {
//     onRebuild(error) {
//       if (error) console.error('❌ Extension rebuild failed:', error);
//       else console.log('✅ Extension rebuilt.');
//     }
//   }
// };

// const buildWebview = {
//   entryPoints: ['src/webview/index.ts'],
//   bundle: true,
//   platform: 'browser',
//   target: 'es2020',
//   outfile: 'out/webview/webview.js',
//   sourcemap: true,
//   watch: isWatch && {
//     onRebuild(error) {
//       if (error) console.error('❌ Webview rebuild failed:', error);
//       else console.log('✅ Webview rebuilt.');
//     }
//   }
// };

async function watch() {
    const extensionContext = await esbuild.context(devExtConfig);
    await extensionContext.watch();
    console.log('🚀 Extension watch started');

    const webviewContext = await esbuild.context(devWebViewConfig);
    await webviewContext.watch();

    console.log('🌐 Webview watch started');

    const shutdown = async () => {
        console.log('\n🛑 Shutting down...');
        await extensionContext.dispose();
        await webviewContext.dispose();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

watch().catch(err => {
  console.error('❌ Failed to start esbuild watchers:', err);
  process.exit(1);
});