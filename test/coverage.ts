/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */

import * as fs from 'fs';
import * as paths from 'path';

export interface TestRunnerOptions {
    includePid?: boolean;
}

export class CoverageRunner {

    private coverageVar = '__coverage__';

    constructor(private options: TestRunnerOptions, private testsRoot: string) {
    }

    /**
     * Dumps the coverage collected by the extension code instrumented with nyc
     * (see the test:instrument script) into the nyc temporary directory of the
     * test suite (<repo root>/.nyc_output/<suite>). The `nyc report` run that
     * follows the test run picks the dump up from there, remaps it back to the
     * TypeScript sources using the source maps embedded by the instrumentation
     * and renders it into the coverage/<suite> directory.
     * Note that as this is called in the process exit callback, all calls must be synchronous.
     */
    public dumpCoverage(): void {
        const cov = global[this.coverageVar];

        if (typeof cov === 'undefined' || Object.keys(cov).length === 0) {
            console.error('No coverage information was collected, exit without writing coverage information');
            return;
        }

        // this.testsRoot is <repo root>/out/test/<suite>
        const suite = paths.basename(this.testsRoot);
        const repoRoot = paths.resolve(this.testsRoot, '..', '..', '..');
        const nycTempDir = paths.join(repoRoot, '.nyc_output', suite);

        // drop the coverage collected by previous runs of this suite,
        // nyc merges everything it finds in its temporary directory
        fs.rmSync(nycTempDir, { recursive: true, force: true });
        fs.mkdirSync(nycTempDir, { recursive: true });

        const {includePid} = this.options;
        const pidExt = includePid ? (`-${  process.pid}`) : '';
        const coverageFile = paths.resolve(nycTempDir, `coverage${pidExt}.json`);
        fs.writeFileSync(coverageFile, JSON.stringify(cov), 'utf8');
        console.log(`Coverage information written to ${coverageFile}`);
    }
}
