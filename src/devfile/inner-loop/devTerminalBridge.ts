/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftTerminalApi, OpenShiftTerminalManager } from '../../webview/openshift-terminal/openShiftTerminal';
import { DevPlatformOutput } from './devPlatform';

/**
 * The raw byte a webview terminal's `input` message carries for a user-typed Ctrl-C. Distinct
 * from the printable `^C` a real pty's line discipline echoes — the virtual terminal used here has
 * no such line discipline, so the control byte itself is what arrives.
 */
const CTRL_C = '\u0003';

export function isStopRequest(text: string): boolean {
    return text.includes(CTRL_C);
}

function toTerminalText(line: string): string {
    // Normalize existing newlines and ensure every message ends with \r\n for proper terminal display
    const normalized = line.replace(/\r?\n/g, '\r\n');
    return normalized.endsWith('\r\n') ? normalized : `${normalized}\r\n`;
}

export interface DevTerminalBridge {
    /** Passed straight into `DevPlatform.start()` / `DevSession` to stream session output. */
    readonly output: DevPlatformOutput;
    /** For the caller to focus/kill/forceKill the terminal tab (e.g. `component.ts`'s UI commands). */
    readonly terminal: OpenShiftTerminalApi;
}

/**
 * Creates a virtual (non-pty) OpenShift Terminal tab that streams dev-session output and reports
 * back when the user presses Ctrl-C in it — mirroring the old `odo dev` pty's "^C to stop" UX
 * without shelling out to a real CLI process.
 */
export async function createDevTerminalBridge(
    name: string,
    cwd: string,
    onStopRequested: () => void,
): Promise<DevTerminalBridge> {
    const terminal = await OpenShiftTerminalManager.getInstance().createVirtualTerminal(
        name,
        cwd,
        process.env,
        {
            onText: (text: string) => {
                if (isStopRequest(text)) {
                    onStopRequested();
                }
            },
        },
    );

    return {
        output: {
            onOutput: (line: string) => terminal.sendText(toTerminalText(line)),
        },
        terminal,
    };
}
