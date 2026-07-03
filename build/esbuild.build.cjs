/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

const { buildExtension } = require('./esbuild.extension.cjs');
const { buildWebviews } = require('./esbuild.webviews.cjs');

// eslint-disable no-console

async function buildAll() {
    await buildExtension();
    await buildWebviews();
}

buildAll().catch(err => {
    console.error('❌ Build failed:', err);
    process.exit(1);
});