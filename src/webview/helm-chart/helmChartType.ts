/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export interface ChartResponse {
    repoName: string,
    repoURL: string,
    chartName: string,
    chartVersions: Chart[],
    displayName: string,
    isExpand?: boolean
}

export interface HelmRepo {
    name: string;
    url: string;
}

export interface Annotation {
    'charts.openshift.io/archs': string,
    'charts.openshift.io/digest': string,
    'charts.openshift.io/lastCertifiedTimestamp': string,
    'charts.openshift.io/name': string,
    'charts.openshift.io/provider': string,
    'charts.openshift.io/providerType': string,
    'charts.openshift.io/submissionTimestamp': string,
    'charts.openshift.io/supportedOpenShiftVersions': string,
    'charts.openshift.io/supportURL': string,
    'charts.openshift.io/testedOpenShiftVersion': string,
}

export interface Maintainer {
    name: string;
    email: string;
    url: string;
}

export interface Chart {
    annotations: Annotation,
    apiVersion: string,
    appVersion: string,
    description: string,
    digest: string,
    homeURL?: string,
    icon: string,
    keywords: string[],
    kubeVersion: string,
    maintainers: Maintainer[],
    name: string,
    urls: string[],
    version: string,
}
