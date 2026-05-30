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
import { CommandResolver } from './commandResolver';
import { CompositeCommand } from './compositeCommand';
import { ParallelCompositeCommand } from './parallelCompositeCommand';

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

        await OpenShiftTerminalManager
            .getInstance()
            .createTerminal(
                command,
                `Run '${resolvedExec.commandLine}'`,
                componentFolder.contextPath,
            );
    }
}

export class DevfileCommandRunner {

    public static async execute(
        componentFolder: ComponentWorkspaceFolder,
        commandId: string,
    ): Promise<void> {

        const devfile =
            componentFolder.component.devfileData.devfile;

        const command =
            CommandResolver.getCommand(
                devfile,
                commandId,
            );

        if (command.exec) {

            await ExecCommandExecutor.execute(
                componentFolder,
                command.exec,
            );

            return;
        }

        if (command.composite) {

            const isParallel =
                (command.composite as {
                    parallel?: boolean;
                }).parallel === true;

            if (isParallel) {

                await ParallelCompositeCommand.execute(
                    componentFolder,
                    command,
                );

            } else {

                await CompositeCommand.execute(
                    componentFolder,
                    command,
                );
            }

            return;
        }

        throw new Error(
            `Unsupported command type '${commandId}'`,
        );
    }
}
