/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ComponentWorkspaceFolder } from '../odo/workspace';
import { Exec } from '../odo/componentTypeDescription';
import { VariableResolver } from './variableResolver';
import { Oc } from '../oc/ocWrapper';
import { CommandText } from '../base/command';
import { OpenShiftTerminalManager } from '../webview/openshift-terminal/openShiftTerminal';

export class ExecCommandExecutor {

    public static async execute(
        componentFolder: ComponentWorkspaceFolder,
        exec: Exec,
    ): Promise<void> {

        const devfile =
            componentFolder.component.devfileData.devfile;

        const resolvedExec =
            VariableResolver.resolveExec(
                devfile,
                exec,
            );

        const componentName =
            devfile.metadata.name;

        const podName =
            await Oc.Instance.getComponentPod(
                componentName,
            );

        const command = new CommandText(
            'oc',
            `exec ${podName} -c ${resolvedExec.component} -- sh -c "cd ${resolvedExec.workingDir} && ${resolvedExec.commandLine}"`,
        );

        void OpenShiftTerminalManager.getInstance().createTerminal(
            command,
            `Component ${componentName}: Run '${resolvedExec.commandLine}' Command`,
            componentFolder.contextPath
        );
    }
}
