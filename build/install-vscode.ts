import cp = require('child_process');
import path = require('path');
const downloadAndUnzipVSCode = require('vscode-test').downloadAndUnzipVSCode;
downloadAndUnzipVSCode().then((executable) => {
    executable = path.join(path.dirname(executable), 'bin', 'code');
    cp.execSync(`${executable} --install-extension ms-kubernetes-tools.vscode-kubernetes-tools`);
});