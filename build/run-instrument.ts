/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import * as glob from 'glob';
import { createInstrumenter } from 'istanbul-lib-instrument';
import * as path from 'path';

/* eslint-disable no-console */
console.log('Instrumenting files...');

const instrumenter = createInstrumenter({
  coverageVariable: '__coverage__',
  embedSource: true,   // Embed the source code into the instrumented file
});

// Find the Extension root directory
console.log(`Script File: ${__filename}`);
console.log(`Script Dir: ${__dirname}`);
const extDir = path.resolve(__dirname, __dirname.endsWith('out/build') ? '../../' : '../');
console.log(`Extension Root dir: ${extDir}`);

// Define the source and output directories
const sourceDir = path.resolve(extDir, 'out/src-orig'); // Original source directory
const outputDir = path.resolve(extDir, 'out/src'); // Instrumented files will be saved here

console.log('Source dir: ', sourceDir);
console.log('Output dir: ', outputDir);

// Ensure the output directory exists
mkdirSync(outputDir, { recursive: true });

// Use glob to match all JavaScript files in the source directory
const files = glob.sync(path.join(sourceDir, '**/*'));
  // Loop over each file and instrument it

files.forEach((file) => {
    process.stdout.write(`Instrumenting: ${file}... `);

    // Get the relative path of the file and write the instrumented code to the output directory
    const relativePath = path.relative(sourceDir, file);
    const outputPath = path.join(outputDir, relativePath);

    // Ensure the directory exists
    mkdirSync(path.dirname(outputPath), { recursive: true });

    const stats = statSync(file);
    if (stats.isDirectory()) {
        console.log('Directory');
    } else if (stats.isFile()) {
        const code = readFileSync(file, 'utf8');
        const isJsFile = /\.js$/i.test(file);
        const instrumentedCode = isJsFile ? instrumenter.instrumentSync(code, file) : code;


        // Write the instrumented file
        writeFileSync(outputPath, instrumentedCode, 'utf8');
        console.log(isJsFile ? 'Done' : 'Skipped');
    }
});

console.log('Files have been instrumented.');
