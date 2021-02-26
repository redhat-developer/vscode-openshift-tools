/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
/* eslint-disable global-require */

import paths = require('path');
import fs = require('fs');

const istanbul = require('istanbul');
const remapIstanbul = require('remap-istanbul');

function _mkDirIfExists(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
}

export interface TestRunnerOptions {
    relativeCoverageDir?: string;
    relativeSourcePath?: string;
    ignorePatterns?: string[];
    includePid?: boolean;
    reports?: string[];
    verbose?: boolean;
}

export class CoverageRunner {

    private coverageVar = '__coverage__';

    constructor(private options: TestRunnerOptions, private testsRoot: string) {
    }

    /**
     * Writes a coverage report.
     * Note that as this is called in the process exit callback, all calls must be synchronous.
     *
     * @returns {void}
     *
     * @memberOf CoverageRunner
     */
    public reportCoverage(): void {
        // istanbul.hook.unhookRequire();

        if (typeof global[this.coverageVar] === 'undefined' || Object.keys(global[this.coverageVar]).length === 0) {
            console.error('No coverage information was collected, exit without writing coverage information');
            return;
        }
        const cov = global[this.coverageVar];

        const reportingDir = paths.join(this.testsRoot, this.options.relativeCoverageDir);
        const {includePid} = this.options;
        const pidExt = includePid ? (`-${  process.pid}`) : '';
        const coverageFile = paths.resolve(reportingDir, `coverage${pidExt}.json`);

        // yes, do this again since some test runners could clean the dir initially created
        _mkDirIfExists(reportingDir);

        fs.writeFileSync(coverageFile, JSON.stringify(cov), 'utf8');

        const remappedCollector = remapIstanbul.remap(cov, {
            warn: (warning: any) => {
                    console.warn(warning);
            }
        });

        const reporter = new istanbul.Reporter(undefined, reportingDir);
        const reportTypes = (this.options.reports instanceof Array) ? this.options.reports : ['lcov'];
        reporter.addAll(reportTypes);
        reporter.write(remappedCollector, true, () => {
            console.log(`Reports written to ${reportingDir}`);
        });
    }
}
