/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Apply, Container, Data, Exec } from '../odo/componentTypeDescription';

export class VariableResolver {
    private static readonly VARIABLE_REGEX = /\$\{([^}]+)\}/g;

    public static resolveExec(devfile: Data, exec: Exec): Exec {
        return {
            ...exec,
            workingDir: this.resolveValue(devfile, exec.workingDir ?? '/projects', exec.component),
            commandLine: this.resolveValue(devfile, exec.commandLine, exec.component),
        };
    }

    public static resolveApply(devfile: Data, apply: Apply): Apply {
        return {
            ...apply,
            component: this.resolveValue(devfile, apply.component),
        };
    }

    public static resolveKubernetesContent(devfile: Data, content: string): string {
        return this.resolveValue(devfile, content);
    }

    public static resolveValue(devfile: Data, value: string, componentName?: string): string {
        if (!value) {
            return value;
        }

        return value.replace(this.VARIABLE_REGEX, (_, variable) =>
            this.resolveVariable(devfile, variable, componentName),
        );
    }

    private static resolveVariable(
        devfile: Data,
        variable: string,
        componentName?: string,
    ): string {
        if (variable === 'PROJECT_SOURCE') {
            return '/projects';
        }

        // Check devfile.variables (from resolved devfile with merged parents)
        if (devfile.variables && devfile.variables[variable]) {
            return devfile.variables[variable];
        }

        if (componentName) {
            const component = devfile.components.find((c) => c.name === componentName);

            const container = component?.container;

            const envValue = this.findEnvValue(container, variable);

            if (envValue) {
                return envValue;
            }
        }

        return process.env[variable] ?? `\${${variable}}`;
    }

    private static findEnvValue(
        container: Container | undefined,
        variable: string,
    ): string | undefined {
        const env = (
            container as unknown as {
                env?: {
                    name: string;
                    value: string;
                }[];
            }
        )?.env;

        return env?.find((e) => e.name === variable)?.value;
    }
}
