/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export interface ComponentDescription {
    schemaVersion: string;
    metadata: {
        name: string;
        version: string;
    },
    components: [
        {
            name: 'runtime';
            container: {
                image: string;
                volumeMounts: [
                    {
                        name: string;
                        path: string;
                    }
                ],
                memoryLimit: string
                mountSources: boolean;
                endpoints: [
                    {
                        name: string;
                        targetPort: number;
                        exposure: string;
                        protocol: string;
                        path: string;
                    }
                ]
            }
        },
        {
            name: 'm2';
            volume: {
                size: string;
            }
        }
    ],
    starterProjects: [
        {
            name: string;
            git: {
                remotes: {
                    origin: string;
                }
            }
        }
    ],
    commands: [
        {
            id: string;
            exec: {
                group: {
                    kind: string;
                    isDefault: boolean;
                },
                commandLine: string;
                component: string;
            }
        }
    ]
}