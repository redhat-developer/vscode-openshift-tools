/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ChangeEvent } from 'react';
import { ComponentTypeDescription, Registry } from '../../odo/componentType';
import { StarterProject } from '../../odo/componentTypeDescription';
import { ChartResponse } from '../helm-chart/helmChartType';

export interface DefaultProps {
    analytics?: import('@segment/analytics-next').Analytics;
}

export interface StarterProjectDisplayProps extends DefaultProps {
    project: StarterProject | any;
}

export interface SearchBarProps extends DefaultProps {
    title: string,
    onSearchBarChange: (value: string) => void;
    searchBarValue: string;
}

export interface FilterProps extends DefaultProps {
    id: string,
    registries?: Registry[],
    onCheckBoxChange: (event: ChangeEvent<HTMLInputElement>, checked: boolean) => void;
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
