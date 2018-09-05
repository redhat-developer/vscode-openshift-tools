import { window, Terminal } from 'vscode';
 
export function createTerminal(name: string, cwd: string, env: NodeJS.ProcessEnv = process.env ): Terminal {
    return window.createTerminal(name, process.platform === 'win32'? undefined : '/bin/bash');
}