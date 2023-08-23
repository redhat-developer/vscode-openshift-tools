/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ChangeEvent } from 'react';
import { ComponentTypeDescription, Registry } from '../../odo/componentType';
import { StarterProject } from '../../odo/componentTypeDescription';
import { ChartResponse } from '../helm-chart/helmChartType';
import { Uri } from 'vscode';

export interface DefaultProps {
    analytics?: import('@segment/analytics-next').Analytics;
}

export interface ClusterViewProps extends DefaultProps {
    vscode: VscodeAPI;
    crc: string;
    openshiftCrc: string;
}

export interface StarterProjectDisplayProps extends DefaultProps {
    project: StarterProject | any;
}

export interface SearchBarProps extends DefaultProps {
    title: string;
    onSearchBarChange: (value: string) => void;
    searchBarValue: string;
    resultCount: number;
}

export interface FilterProps extends DefaultProps {
    id: string;
    registries?: Registry[];
    onCheckBoxChange: (value: string | string[]) => void;
}

export interface ErrorProps extends DefaultProps {
    message: string;
}

export interface CompTypeDesc extends ComponentTypeDescription {
    priority: number;
}

export interface DevfileHomePageProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    compDescriptions: CompTypeDesc[];
    themeKind: number;
}

export interface HelmChartHomePageProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    helmEntries: ChartResponse[];
    themeKind: number;
}

export interface CreateFunctionPageProps extends DefaultProps {
    onCreateSubmit: (name: string, language: string, template: string, location: Uri, image: string) => void;
}

export interface InvokeFunctionPageProps extends DefaultProps {
    id: any;
    name: string;
    uri: Uri;
    instance: string;
    invokeURL: string;
    onInvokeSubmit: (name: string, instance: string, id: string, path: string, contentType: string, format: string, source: string,
        type: string, data: string, file: string, enableUrl: boolean, invokeURL: string) => void;
}

export interface BuildFunctionPageProps extends DefaultProps {
    name: string;
    loadScreen: boolean;
    onBuildSubmit: (image: string, location: Uri) => void;
}

export interface ModalProp extends DefaultProps {
    show: boolean;
}

export interface RunFunctionPageProps extends DefaultProps {
    name: string;
    folderPath: Uri;
    skip: (stepCount: number) => void;
    onRunSubmit: (folderPath: Uri, build: boolean) => void;
}
