/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import Mocha from 'mocha';

/**
 * Creates a Mocha instance configured for this repository's test runs, combining the
 * options shared by all test kinds with the test-kind specific ones passed as
 * `options` (which take precedence over the defaults).
 *
 * Mocha provides no option for configuring the reporter color palette: its 'spec'
 * reporter renders passing test titles ('pass'), failure stack traces ('error stack')
 * and result durations ('light') in 'bright black' (ANSI 90), which on dark terminal
 * themes, e.g. VS Code Dark Modern, is nearly indistinguishable from the terminal
 * background (#3b3b3b on #1f1f1f). The palette is therefore adjusted directly on
 * 'Mocha.reporters.Base.colors', which the reporters read at render time, re-coloring
 * those elements with the terminal's default foreground color (ANSI 0), readable on
 * both light and dark themes. The colored checkmarks, diffs, error messages and
 * pass/fail summaries are kept unchanged.
 */
export function createMocha(options: Mocha.MochaOptions): Mocha {
    Mocha.reporters.Base.colors.pass = 0;
    Mocha.reporters.Base.colors['error stack'] = 0;
    Mocha.reporters.Base.colors.light = 0;
    return new Mocha({
        reporter: 'spec',
        ui: 'tdd',
        color: true,
        ...options
    });
}
