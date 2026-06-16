/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CommandText } from '../base/command';
import { CliChannel } from '../cli';
import { ToolsConfig } from '../tools';

interface ContainerRuntimeInfo {
    name: 'Podman' | 'Docker';
    version: string;
}

interface OcInfo {
    clientVersion?: string;
    serverVersion?: string;
}

interface ToolInfo {
    name: string;
    version?: string;
    location?: string;
    bundled: boolean;
}

export class AboutInfoProvider {

    public static async collect(): Promise<string> {
        const extensionVersion =  this.getExtensionVersion();
        const [ ocInfo, runtimes ] = await Promise.all([
            this.getOcInfo(),
            this.getContainerRuntimes(),
        ]);
        const clusterInfo = await this.getClusterInfo(ocInfo);
        const bundledTools = await this.getBundledTools();
        const notBundledTools = await this.getNotBundledTools(runtimes);
        const crcTool = await this.getCRCTool();

        const lines: string[] = [
            '==================================================',
            'OpenShift Tools',
            '==================================================',
            '',
            `Extension Version : ${extensionVersion}`,
            `VS Code           : ${vscode.version}`,
            `Node.js           : ${process.version}`,
            `Platform          : ${process.platform}-${process.arch}`,
            '',
            'OpenShift Client',
            '----------------',
            `oc Version        : ${ocInfo?.clientVersion ?? 'Not detected'}`,
            '',
            'Cluster',
            '-------',
        ];

        if (clusterInfo) {
            lines.push(
                `Server            : ${clusterInfo.server}`,
                `Context           : ${clusterInfo.context}`,
                `Kubernetes        : ${clusterInfo.kubernetesVersion}`,
            );
        } else {
            lines.push('Not connected');
        }

        lines.push(
            '',
            'Container Runtime',
            '-----------------',
        );

        if (runtimes.length === 0) {
            lines.push('Not detected');
        } else {
            for (const runtime of runtimes) {
                lines.push(
                    `${runtime.name.padEnd(18)}: ${runtime.version}`,
                );
            }
        }

        lines.push(
            '',
            'Bundled Tools',
            '-------------',
        );

        for (const tool of bundledTools) {
            if (!tool.location) {
                lines.push(
                    `${tool.name.padEnd(18)}: Not detected`,
                );
                continue;
            }

            const version = tool.version ?? 'Unknown';

            lines.push(
                `${tool.name.padEnd(18)}: ${version}`,
                `                    ${tool.location}`,
                ''
            );
        }

        lines.push(
            '',
            'Not Bundled Tools',
            '-----------------',
        );

        for (const tool of notBundledTools) {
            if (!tool.location) {
                lines.push(
                    `${tool.name.padEnd(18)}: Not detected`,
                );
                continue;
            }

            const version = tool.version ?? 'Unknown';

            lines.push(
                `${tool.name.padEnd(18)}: ${version}`,
                `                    ${tool.location}`,
                ''
            );
        }

        if (crcTool) {
            lines.push(
                '',
                'CRC Tool',
                '--------',
            );


            const version = crcTool.version ?? 'Unknown';

            lines.push(
                `${crcTool.name.padEnd(18)}: ${version}`,
                `                    ${crcTool.location ? crcTool.location : 'Not detected'}`,
                ''
            );
        }

        return lines.join('\n');
    }

    private static getExtensionVersion(): string {
        const extension = vscode.extensions.getExtension(
            'redhat.vscode-openshift-connector',
        );

        return extension?.packageJSON?.version ?? 'Unknown';
    }

    private static async getOcInfo(): Promise<OcInfo | undefined> {
        try {
            const result = await CliChannel.getInstance().executeTool(
                new CommandText('oc', 'version -o json'),
                undefined,
                true,
            );

            const parsed = JSON.parse(result.stdout);

            return {
                clientVersion: parsed.clientVersion?.gitVersion,
                serverVersion: parsed.serverVersion?.gitVersion,
            };
        } catch {
            return undefined;
        }
    }

    private static async getClusterInfo(
        ocInfo: OcInfo | undefined,
    ): Promise<{
        server: string;
        context: string;
        kubernetesVersion: string;
    } | undefined> {
        try {
            const [serverResult, contextResult] = await Promise.all([
                CliChannel.getInstance().executeTool(
                    new CommandText('oc', 'whoami --show-server'),
                    undefined,
                    true,
                ),
                CliChannel.getInstance().executeTool(
                    new CommandText('oc', 'config current-context'),
                    undefined,
                    true,
                ),
            ]);

            return {
                server: serverResult.stdout.trim(),
                context: contextResult.stdout.trim(),
                kubernetesVersion:
                    ocInfo?.serverVersion ??
                    ocInfo?.clientVersion ??
                    'Unknown',
            };
        } catch {
            return undefined;
        }
    }

    private static async getContainerRuntimes(): Promise<ContainerRuntimeInfo[]> {
        const runtimes: ContainerRuntimeInfo[] = [];

        const podmanVersion = await this.getPodmanVersion();
        if (podmanVersion) {
            runtimes.push({
                name: 'Podman',
                version: podmanVersion,
            });
        }

        const dockerVersion = await this.getDockerVersion();
        if (dockerVersion) {
            runtimes.push({
                name: 'Docker',
                version: dockerVersion,
            });
        }

        return runtimes;
    }

    private static async getPodmanVersion(): Promise<string | undefined> {
        try {
            const result = await CliChannel.getInstance().executeTool(
                new CommandText('podman', 'version --format json'),
                undefined,
                true,
            );

            if (!result.stdout?.trim()) {
                return undefined;
            }

            const parsed = JSON.parse(result.stdout);

            return parsed.Client?.Version;
        } catch {
            return undefined;
        }
    }

    private static async getDockerVersion(): Promise<string | undefined> {
        try {
            const result = await CliChannel.getInstance().executeTool(
                new CommandText('docker', 'version --format json'),
                undefined,
                true,
            );

            if (!result.stdout?.trim()) {
                return undefined;
            }

            const parsed = JSON.parse(result.stdout);

            return parsed.Client?.Version;
        } catch {
            return undefined;
        }
    }

    private static async getBundledTools(): Promise<ToolInfo[]> {
        const result: ToolInfo[] = [];

        const names = Object.keys(ToolsConfig.tools)
            .filter(name =>
                ToolsConfig.tools[name]?.cmdFileName &&
                ToolsConfig.tools[name]?.notBundled !== true
            )
            .sort();

        for (const toolName of names) {
            try {
                const location = await ToolsConfig.detect(toolName);

                result.push({
                    name: toolName,
                    version: location ? await ToolsConfig.getVersion(location) : undefined,
                    location,
                    bundled: true,
                });
            } catch {
                result.push({
                    name: toolName,
                    bundled: true,
                });
            }
        }

        return result;
    }

    private static async getNotBundledTools(
        runtimes: ContainerRuntimeInfo[],
    ): Promise<ToolInfo[]> {
        const result: ToolInfo[] = [];

        const names = Object.keys(ToolsConfig.tools)
            .filter(name =>
                ToolsConfig.tools[name]?.cmdFileName &&
                ToolsConfig.tools[name]?.notBundled === true
            )
            .sort();

        for (const toolName of names) {
            try {
                const location = await ToolsConfig.detect(toolName);
                const runtime = runtimes.find(r => r.name?.toLowerCase() === toolName);

                result.push({
                    name: toolName,
                    version: runtime?.version
                        ?? (location ? await ToolsConfig.getVersion(location) : undefined),
                    location,
                    bundled: false,
                });
            } catch {
                result.push({
                    name: toolName,
                    bundled: false,
                });
            }
        }

        return result;
    }

    private static async getCRCTool(): Promise<ToolInfo> {
        const crc = ToolsConfig.tools?.crc;

        if (!crc) {
            return undefined;
        }

        // Try guessing its location from the cinfiguration preferences
        const crcBinary = vscode.workspace.getConfiguration('openshiftToolkit').get<string>('crcBinaryLocation');

        return {
            name: 'crc',
            version: crc.crcVersion ?? 'Unknown',
            location: crcBinary,
            bundled: true,
        };
    }
}