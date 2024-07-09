/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as semver from 'semver';
import * as _ from 'lodash';
import { CommandText } from '../base/command';
import { K8sResourceCommon, K8sResourceKind, Service } from '../k8s/olm/types';
import { CliExitData } from '../util/childProcessUtil';
import { Odo } from './odoWrapper';
import { vsCommand } from '../vscommand';
import CreateDeploymentLoader from '../webview/create-deployment/createDeploymentLoader';

export interface BuilderImage {
    readonly name: string;
    readonly tag?: string;
    obj: K8sResourceKind;
    displayName: string;
    description: string;
    title: string;
    iconClass?: string;
    tags: ImageTag[];
    recentTag: ImageTag;
    imageStreamNamespace: string;
}

export type TemplateKind = {
    message?: string;
    objects: unknown[];
    parameters: TemplateParameter[];
    labels?: unknown[];
} & K8sResourceCommon;

type TemplateParameter = {
    name: string;
    value?: string;
    displayName?: string;
    description?: string;
    generate?: string;
    required?: boolean;
};

interface ImageTag {
    name: string;
    annotations: {
        [key: string]: string;
    };
    generation: number;
    [key: string]: unknown;
}

export interface NormalizedBuilderImages {
    [builderImageName: string]: BuilderImage;
}

export class BuilderImageWrapper {

    private static instance: BuilderImageWrapper;

    public static get Instance(): BuilderImageWrapper {
        if (!BuilderImageWrapper.instance) {
            BuilderImageWrapper.instance = new BuilderImageWrapper();
        }
        return BuilderImageWrapper.instance;
    }

    private constructor() {
        // no state
    }

    @vsCommand('openshift.deployment.create.buildConfig')
    static async createComponent(): Promise<void> {
        await CreateDeploymentLoader.loadView('Create Deployment');
    }

    public async getBuilder(): Promise<NormalizedBuilderImages> {
        const cliData: CliExitData = await Odo.Instance.execute(
            new CommandText('oc', 'get imagestreams -o json -n openshift')
        );
        const parse: Service = JSON.parse(cliData.stdout) as Service;
        const data = Array.isArray(parse.items) ? parse.items : [parse.items];
        const builderImageStreams = data.filter((imageStream) => isBuilder(imageStream));
        return builderImageStreams.reduce((builderImages: NormalizedBuilderImages, imageStream) => {
            const tags = getBuilderTagsSortedByVersion(imageStream);
            const recentTag = getMostRecentBuilderTag(imageStream);
            const { name } = imageStream.metadata;
            const displayName = imageStream?.metadata?.annotations?.['openshift.io/display-name'];
            const description = recentTag?.annotations?.description;
            const imageStreamNamespace = imageStream.metadata.namespace;
            const title = displayName && displayName.length < 14 ? displayName : prettifyName(name);
            const iconClass = getImageStreamIcon(recentTag);

            builderImages[name] = {
                obj: imageStream,
                name,
                displayName,
                description,
                title,
                iconClass,
                tags,
                recentTag,
                imageStreamNamespace,
            };
            return builderImages;
        }, {});
    }
}

function isBuilder(imageStream: K8sResourceKind): boolean {
    const statusTags = getStatusTags(imageStream);
    return _.size(_.filter(imageStream.spec.tags, (tag: ImageTag) => isBuilderTag(tag) && statusTags[tag.name])) > 1;
}

function getBuilderTagsSortedByVersion(imageStream: K8sResourceKind): ImageTag[] {
    // Sort tags in reverse order by semver, falling back to a string comparison if not a valid version.
    return getBuilderTags(imageStream).sort(({ name: a }, { name: b }) => {
        const v1 = semver.coerce(a);
        const v2 = semver.coerce(b);
        if (!v1 && !v2) {
            return a.localeCompare(b);
        }
        if (!v1) {
            return 1;
        }
        if (!v2) {
            return -1;
        }
        return semver.rcompare(v1, v2);
    });
};

function getBuilderTags(imageStream: K8sResourceKind): ImageTag[] {
    const statusTags = getStatusTags(imageStream);
    return _.filter(imageStream.spec.tags, (tag: ImageTag) => isBuilderTag(tag) && statusTags[tag.name]) as ImageTag[];
}

function getStatusTags(imageStream: K8sResourceKind) {
    const statusTags = _.get(imageStream, 'status.tags') as ImageTag[];
    return _.keyBy(statusTags, 'tag');
}

function isBuilderTag(specTag: unknown): boolean {
    // A spec tag has annotations tags, which is a comma-delimited string (e.g., 'builder,httpd').
    const annotationTags = getAnnotationTags(specTag);
    return _.size(annotationTags) > 1 && _.includes(annotationTags, 'builder') && !_.includes(annotationTags, 'hidden');
};

function getAnnotationTags(specTag: unknown): string[] {
    return _.get(specTag, 'annotations.tags', '').split(/\s*,\s*/);
}

function getMostRecentBuilderTag(imageStream: K8sResourceKind): ImageTag {
    const tags = getBuilderTagsSortedByVersion(imageStream);
    return _.head(tags);
}

function prettifyName(name: string) {
    return name.replace(/(-|^)([^-]?)/g, (_first, prep, letter: string) => {
        return (prep && ' ') + letter.toUpperCase();
    });
}

function  getImageStreamIcon(tag: ImageTag): string {
    return _.get(tag, 'annotations.iconClass') as string;
};
