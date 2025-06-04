/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

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

const esmImportTargets = {
  'clipboardy': { entry: 'node_modules/clipboardy/index.js', outfile: 'out/esm/clipboardy.cjs' },
  'got': { entry: 'node_modules/got/dist/source/index.js', outfile: 'out/esm/got.cjs' },
  '@kubernetes/client-node': { entry: 'node_modules/@kubernetes/client-node/dist/index.js', outfile: 'out/esm/k8s-client-node.cjs' }
};

const srcDir = 'src'; // Input source directory
const outDir = 'out'; // Output dist directory

module.exports = {
  webviews,
  esmImportTargets,
  srcDir,
  outDir
};