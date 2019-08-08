import cp = require('child_process');
import path = require('path');
import { platform } from 'os';
const downloadAndUnzipVSCode = require('vscode-test').downloadAndUnzipVSCode;
downloadAndUnzipVSCode().then((executable: string) => {
    if (platform() === 'darwin') {
        executable = `'${path.join(executable.substring(0, executable.indexOf('.app')+4), 'Contents', 'Resources', 'app', 'bin', 'code')}'`;
    } else {
        executable = path.join(path.dirname(executable), 'bin', 'code');
    }
    cp.execSync(`${executable} --install-extension ms-kubernetes-tools.vscode-kubernetes-tools`);
});