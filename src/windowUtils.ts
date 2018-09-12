import { window, Terminal, TerminalOptions } from 'vscode';
import * as path from 'path';
import { Platform } from './platform';

const toolsLocation = path.resolve(Platform.getUserHomePath(), '.vs-openshift');
 
export function createTerminal(name: string, cwd: string, env: NodeJS.ProcessEnv = process.env): Terminal {
    let finalEnv: NodeJS.ProcessEnv = {};
    Object.assign(finalEnv, env);
    finalEnv.PATH = `${toolsLocation}:${env.PATH}`;

    const options: TerminalOptions = {
        cwd: cwd,
        name: name,
        env: finalEnv,
        shellPath: process.platform === 'win32'? undefined : '/bin/bash'
    };
    return window.createTerminal(options);
}