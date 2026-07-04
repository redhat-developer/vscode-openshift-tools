/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

const path = require('path');
const Module = require('module');

// Find project root by looking for package.json
let projectRoot = __dirname;
while (projectRoot !== path.dirname(projectRoot)) {
  if (require('fs').existsSync(path.join(projectRoot, 'package.json'))) {
    const pkg = JSON.parse(require('fs').readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
    if (pkg.name === 'vscode-openshift-connector') {
      break;
    }
  }
  projectRoot = path.dirname(projectRoot);
}

// --- ESM module aliases mapping
// Use absolute paths based on project root
const aliases = {
  'clipboardy': path.join(projectRoot, 'out/esm/clipboardy.cjs'),
  'got': path.join(projectRoot, 'out/esm/got.cjs'),
  'uuid': path.join(projectRoot, 'out/esm/uuid.cjs'),
  '@kubernetes/client-node': path.join(projectRoot, 'out/esm/k8s-client-node.cjs'),
  '@apidevtools/json-schema-ref-parser': path.join(projectRoot, 'out/esm/apidevtools-json-schema-ref-parser.cjs'),
};

// Custom module resolver to handle both base imports and subpath imports
// E.g., both '@kubernetes/client-node' and '@kubernetes/client-node/dist/config_types'
// should resolve to the same bundled .cjs file
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function(request, parent, isMain, options) {
  // Check for exact match first
  if (aliases[request]) {
    return aliases[request];
  }

  // Check for subpath imports (e.g., '@kubernetes/client-node/dist/config_types')
  for (const [pkg, target] of Object.entries(aliases)) {
    if (request === pkg || request.startsWith(`${pkg}/`)) {
      // Both the base package and any subpaths resolve to the bundled file
      return target;
    }
  }

  // Not an aliased module, use original resolution
  return originalResolveFilename.call(this, request, parent, isMain, options);
};