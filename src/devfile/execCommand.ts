/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandOption, CommandText } from '../base/command';
import { Oc } from '../oc/ocWrapper';
import { Exec } from '../odo/componentTypeDescription';
import { ComponentWorkspaceFolder } from '../odo/workspace';
import { OpenShiftTerminalManager } from '../webview/openshift-terminal/openShiftTerminal';
import { DevfileResolver } from './devfileResolver';
import { VariableResolver } from './variableResolver';

export class ExecCommandExecutor {
    public static async execute(
        componentFolder: ComponentWorkspaceFolder,
        commandId: string,
        exec: Exec,
    ): Promise<void> {
        const rawDevfile = componentFolder.component.devfileData.devfile;

        const resolver = new DevfileResolver();
        const devfile = await resolver.resolve(rawDevfile);

        const resolvedExec = VariableResolver.resolveExec(devfile, exec);

        const componentName = devfile.metadata.name;

        const podName = await Oc.Instance.getComponentPod(componentName);

        const command = new CommandText('oc', 'exec', [
            new CommandOption(podName),
            new CommandOption('-c'),
            new CommandOption(resolvedExec.component),
            new CommandOption('--'),
            new CommandOption('sh'),
            new CommandOption('-c'),
            new CommandOption(`cd ${resolvedExec.workingDir} && ${resolvedExec.commandLine}`),
        ]);

        void OpenShiftTerminalManager.getInstance().createTerminal(
            command,
            `Component ${componentName}: Run '${commandId}' Command`,
            componentFolder.contextPath,
        );
    }
}
