/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

const path = require('path');
const moduleAlias = require('module-alias');

// --- Force specific modules to load from out/esm
moduleAlias.addAliases({
  'clipboardy': path.resolve(__dirname, '../out/esm/clipboardy.cjs'),
  'got': path.resolve(__dirname, '../out/esm/got.cjs'),
  '@kubernetes/client-node': path.resolve(__dirname, '../out/esm/k8s-client-node.cjs'),
});

// --- Register the aliases
moduleAlias();