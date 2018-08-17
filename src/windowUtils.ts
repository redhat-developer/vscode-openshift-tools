import { window, Terminal } from 'vscode';
 
export function createTerminal(name: string, cwd: string, env: NodeJS.ProcessEnv = process.env ): Terminal {
    return window.createTerminal(name, "/bin/bash");
}