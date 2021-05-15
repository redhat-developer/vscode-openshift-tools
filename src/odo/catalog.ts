/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export interface Registry {
    Name: string;
    URL: string;
    Secure: boolean;
}

export const DefaultRegistry: Registry = {
    Name: 'DefaultDevfileRegistry',
    URL: 'https://github.com/odo-devfiles/registry',
    Secure: false
};

export interface ComponentDescription {
    schemaVersion: string;
    metadata: {
        name: string;
        version: string;
    };
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
    ];
    starterProjects: StarterProjectDescription[];
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
    ];
}

export interface StarterProjectDescription {
    name: string;
    description?: string;
    git: {
        remotes: {
            origin: string;
        }
    }
}