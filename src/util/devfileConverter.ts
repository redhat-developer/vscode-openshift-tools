/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import {
    V222Devfile,
    V222DevfileCommands,
    V222DevfileComponents,
    V222DevfileComponentsItemsContainerEndpoints,
    V222DevfileComponentsItemsContainerEnv,
    V222DevfileComponentsItemsContainerVolumeMounts,
    V222DevfileMetadata,
    V222DevfileProjects
} from '@devfile/api';
import { Data, Endpoint, Metadata } from '../odo/componentTypeDescription';
import { ComponentV1, DevfileCommandV1, DevfileV1, DevfileVolumeV1, EndpointV1, EnvV1, MetadataV1, ProjectV1 } from './devfileV1Type';

export type DevfileMetadataLike = V222DevfileMetadata & object;

export type DevfileMetadata = DevfileMetadataLike & Required<Pick<DevfileMetadataLike, 'name'>>;

export type DevfileLike = V222Devfile & {
    metadata?: DevfileMetadataLike;
};

export type Devfile = DevfileLike &
    Required<Pick<DevfileLike, 'metadata'>> & {
        metadata?: DevfileMetadata;
    };

function setGroup(name: string): any {
    let kindVal = undefined;
    if (name && name.trim().length > 0) {
        if (name.indexOf('run') !== -1) {
            kindVal = 'run'
        } else if (name.indexOf('install') !== -1) {
            kindVal = 'build'
        } else if (name.indexOf('debug') !== -1) {
            kindVal = 'debug'
        } else if (name.indexOf('test') !== -1) {
            kindVal = 'test'
        }
        if (kindVal) {
            return {
                isDefault: true,
                kind: kindVal
            };
        }
    }
    return undefined;
}

export class DevfileConverter {

    static instance: DevfileConverter;

    public readonly VSCODE_LAUNCH_JSON = '.vscode/launch.json';

    public static getInstance(): DevfileConverter {
        if (!DevfileConverter.instance) {
            DevfileConverter.instance = new DevfileConverter();
        }
        return DevfileConverter.instance;
    }

    devfileV1toDevfileV2(devfileV1: DevfileV1, endPoints: Endpoint[]): Data {
        const devfileV2: Devfile = {
            schemaVersion: '2.1.0',
            metadata: this.metadataV1toMetadataV2(devfileV1.metadata),
            projects: (devfileV1.projects || []).map(project => this.projectV1toProjectV2(project)),
            components: (devfileV1.components || [])
                .map(component => this.componentV1toComponentV2(component))
                .filter(c => c),
            commands: (devfileV1.commands || []).map(command => this.commandV1toCommandV2(command)).filter(c => c),
        };

        devfileV2.components.map((component, index) => {
            if (index === 0) {
                component.container.endpoints = endPoints;
            }
        });

        // handle the ephemeral attribute
        if (
            devfileV1.attributes &&
            devfileV1.attributes.persistVolumes &&
            devfileV1.attributes.persistVolumes === 'false'
        ) {
            devfileV2.attributes = {};
            devfileV2.attributes['controller.devfile.io/storage-type'] = 'ephemeral';
        }

        if (devfileV1.attributes) {
            Object.assign(devfileV2.metadata.attributes, {});
            Object.keys(devfileV1.attributes).forEach(attributeName => {
                devfileV2.metadata.attributes[attributeName] = devfileV1.attributes[attributeName];
            });
        }

        /* inline launch
        const launchCommand = devfileV1.commands?.find(command => command.actions[0].type === 'vscode-launch');
        if (launchCommand) {
            devfileV2.attributes[this.VSCODE_LAUNCH_JSON] = launchCommand.actions[0].referenceContent;
        }*/

        const content = JSON.stringify(devfileV2);
        return JSON.parse(content);
    }

    metadataV1toMetadataV2(metadataV1?: MetadataV1, devfile2MetaData?: Metadata): DevfileMetadata {
        const devfileMetadataV2: any = {};
        if (metadataV1) {
            if (metadataV1.generateName) {
                devfileMetadataV2.name = metadataV1.generateName || devfile2MetaData.name;
                devfileMetadataV2.displayName = metadataV1.generateName || devfile2MetaData.displayName;
                if (!devfileMetadataV2.attributes) {
                    devfileMetadataV2.attributes = {};
                }
                devfileMetadataV2.attributes['metadata-name-field'] = 'generateName';
                devfileMetadataV2.attributes['metadata-name-original-value'] = metadataV1.generateName;
                // remove the trailing - to make it compliant with kubernetes name
                if (devfileMetadataV2.name.endsWith('-')) {
                    devfileMetadataV2.name = devfileMetadataV2.name.slice(0, -1);
                }
            }
            if (metadataV1.name) {
                devfileMetadataV2.name = metadataV1.name || devfile2MetaData.name;
                devfileMetadataV2.displayName = metadataV1.name || devfile2MetaData.displayName;
                if (!devfileMetadataV2.attributes) {
                    devfileMetadataV2.attributes = {};
                }
                devfileMetadataV2.attributes['metadata-name-field'] = 'name';
            }
        }
        return devfileMetadataV2;
    }

    projectV1toProjectV2(projectV1: ProjectV1): V222DevfileProjects {
        // the name can't have spaces
        // replace space by dash and then remove all special characters
        const projectName = projectV1.name
            .replace(/\s+/g, '-')
            // names should not use _
            .replace(/_/g, '-')
            // names should not use .
            .replace(/\./g, '-')
            // trim '-' character from start or end
            .replace(/^-+|-+$/g, '')
            .toLowerCase();

        const devfileV2Project: any = {
            attributes: {},
            name: projectName,
        };
        if (projectV1.clonePath) {
            devfileV2Project.clonePath = projectV1.clonePath;
        }

        if (projectV1.source) {
            const source = projectV1.source;
            if (source.type === 'git' || source.type === 'github' || source.type === 'bitbucket') {
                const remotes = { origin: source.location };
                devfileV2Project.git = {
                    remotes,
                };
                let checkoutFromRevision;
                if (source.branch) {
                    checkoutFromRevision = source.branch;
                    devfileV2Project.attributes['source-origin'] = 'branch';
                } else if (source.commitId) {
                    checkoutFromRevision = source.commitId;
                    devfileV2Project.attributes['source-origin'] = 'commitId';
                } else if (source.startPoint) {
                    checkoutFromRevision = source.startPoint;
                    devfileV2Project.attributes['source-origin'] = 'startPoint';
                } else if (source.tag) {
                    checkoutFromRevision = source.tag;
                    devfileV2Project.attributes['source-origin'] = 'tag';
                }
                if (checkoutFromRevision) {
                    devfileV2Project.git.checkoutFrom = {
                        revision: checkoutFromRevision,
                    };
                }
            } else if (source.type === 'zip') {
                devfileV2Project.zip = {
                    location: source.location,
                };
            }
        }
        return devfileV2Project;
    }

    componentV1toComponentV2(componentV1: ComponentV1): V222DevfileComponents {
        const devfileV2Component: any = {};

        if (componentV1.alias) {
            devfileV2Component.name = componentV1.alias;
        }

        if (componentV1.type === 'dockerimage') {
            devfileV2Component.container = {
                image: componentV1.image,
            };
            if (componentV1.command) {
                devfileV2Component.container.command = componentV1.command;
            }
            if (componentV1.args) {
                devfileV2Component.container.args = componentV1.args;
            }
            if (componentV1.cpuLimit) {
                devfileV2Component.container.cpuLimit = componentV1.cpuLimit;
            }
            if (componentV1.cpuRequest) {
                devfileV2Component.container.cpuRequest = componentV1.cpuRequest;
            }
            if (componentV1.memoryLimit) {
                devfileV2Component.container.memoryLimit = componentV1.memoryLimit;
            }
            if (componentV1.memoryRequest) {
                devfileV2Component.container.memoryRequest = componentV1.memoryRequest;
            }
            if (componentV1.mountSources) {
                devfileV2Component.container.mountSources = componentV1.mountSources;
            }
            devfileV2Component.container.env = this.componentEnvV1toComponentEnvV2(componentV1.env);
            devfileV2Component.container.volumeMounts = this.componentVolumeV1toComponentVolumeV2(componentV1.volumes);
            devfileV2Component.container.endpoints = this.componentEndpointV1toComponentEndpointV2(componentV1.endpoints);
        } else if (componentV1.type === 'kubernetes') {
            devfileV2Component.kubernetes = {};
            devfileV2Component.kubernetes.inlined = JSON.stringify(componentV1);
        } else if (componentV1.type === 'openshift') {
            devfileV2Component.openshift = {};
            devfileV2Component.openshift.inlined = JSON.stringify(componentV1);
        } else if (componentV1.type === 'chePlugin' || componentV1.type === 'cheEditor') {
            // components are processed as inline attributes
            return undefined;
        }

        return devfileV2Component;
    }

    commandV1toCommandV2(commandV1: DevfileCommandV1): V222DevfileCommands {

        const devfileV2Command: any = {};

        if (commandV1.name) {
            // the id can't have spaces
            // replace space by dash and then remove all special characters
            devfileV2Command.id = commandV1.name
                .replace(/\s+/g, '-')
                .replace(/[^a-zA-Z-]/g, '')
                .toLowerCase();

            // needs to be max 63 characters
            if (devfileV2Command.id.length > 63) {
                devfileV2Command.id = devfileV2Command.id.substring(0, 63);
            }
            // trim '-' character from start or end
            devfileV2Command.id = devfileV2Command.id.replace(/^-+|-+$/g, '');
        }
        if (commandV1.actions && commandV1.actions[0].type === 'exec') {
            devfileV2Command.exec = {};
            const action = commandV1.actions[0];
            // label is the same as name
            if (commandV1.name) {
                devfileV2Command.exec.label = commandV1.name;
            }

            if (action.command) {
                devfileV2Command.exec.commandLine = action.command;
            }
            if (action.component) {
                devfileV2Command.exec.component = action.component;
            }
            if (action.workdir) {
                devfileV2Command.exec.workingDir = '${PROJECT_SOURCE}';
            }
            devfileV2Command.exec.group = setGroup(commandV1.name?.toLowerCase());
            return devfileV2Command;
        }
        // undefined if do not know what to do
        return undefined;
    }

    componentEnvV1toComponentEnvV2(
        componentEnvs?: EnvV1[]
    ): V222DevfileComponentsItemsContainerEnv[] | undefined {
        if (componentEnvs) {
            return componentEnvs.map(envV1 => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const env: any = {};
                if (envV1.name !== undefined) {
                    env.name = envV1.name;
                }
                if (envV1.value !== undefined) {
                    env.value = envV1.value;
                }
                return env;
            });
        }
        return undefined;
    }

    componentVolumeV1toComponentVolumeV2(
        componentVolumes?: DevfileVolumeV1[]
    ): V222DevfileComponentsItemsContainerVolumeMounts[] | undefined {
        if (componentVolumes) {
            return componentVolumes.map(volumeV1 => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const volume: any = {};
                if (volumeV1.name) {
                    volume.name = volumeV1.name;
                    // volume names should not use _
                    volume.name = volume.name.replace(/_/g, '-');
                }
                if (volumeV1.containerPath) {
                    volume.path = volumeV1.containerPath;
                }
                return volume;
            });
        }
        return undefined;
    }

    componentEndpointV1toComponentEndpointV2(
        componentEndpoints?: EndpointV1[]
    ): V222DevfileComponentsItemsContainerEndpoints[] | undefined {
        if (componentEndpoints) {
            return componentEndpoints.map(endpointV1 => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const endpoint: any = {};
                if (endpointV1.name) {
                    // the name can't have spaces
                    // replace space by dash and then remove all special characters
                    const endpointName = endpointV1.name
                        .replace(/\s+/g, '-')
                        // names should not use _
                        .replace(/_/g, '-')
                        // trim '-' character from start or end
                        .replace(/^-+|-+$/g, '')
                        .toLowerCase();

                    endpoint.name = endpointName;
                }
                if (endpointV1.port) {
                    endpoint.targetPort = endpointV1.port;
                }
                if (endpointV1.attributes) {
                    endpoint.attributes = endpointV1.attributes;

                    if (endpoint.attributes.type === 'ide') {
                        endpoint.attributes.type = 'main';
                    }

                    if (endpointV1.attributes.public !== undefined && endpointV1.attributes.public === 'false') {
                        endpoint.exposure = 'internal';
                    }
                }

                return endpoint;
            });
        }
        return undefined;
    }
}
