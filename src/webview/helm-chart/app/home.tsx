/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { makeStyles } from '@material-ui/core';
import { WrapperCardItem as CardItem } from './wrapperCardItem';
import { LoadScreen } from './loading';
import { VSCodeMessage } from '../vsCodeMessage';
import homeStyle from './home.style';
import cardItemStyle from './cardItem.style';
import starterProjectDisplayStyle from './starterProjectDisplay.style';
import { ErrorPage } from './errorPage';
import { ImageList, ImageListItem } from '@mui/material';
import { SearchBar } from './searchBar';
import { ChartResponse } from '../helmChartType';

const useHomeStyles = makeStyles(homeStyle);
const starterProjectDisplayStyles = makeStyles(starterProjectDisplayStyle);
const useCardItemStyles = makeStyles(cardItemStyle);

interface HomePageProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    helmEntries: ChartResponse[];
    themeKind: number;
}

export interface DefaultProps {
    analytics?: import('@segment/analytics-next').Analytics;
}

const HomeItem: React.FC<HomePageProps> = ({
    helmEntries,
    themeKind
}: HomePageProps) => {
    const homeStyleClass = useHomeStyles();
    const cardItemStyle = useCardItemStyles();
    const projectDisplayStyle = starterProjectDisplayStyles();
    return (
        <ImageList className={homeStyleClass.devfileGalleryGrid} cols={4}>
            {
                helmEntries.map((helmEntry: ChartResponse, index: number) => (
                    <ImageListItem key={`imageList-` + index}>
                        <CardItem key={helmEntry.displayName} helmEntry={helmEntry}
                            cardItemStyle={cardItemStyle} projectDisplayStyle={projectDisplayStyle}
                            themeKind={themeKind} />
                    </ImageListItem>
                ))
            }
        </ImageList>
    );
};

export const Home: React.FC<DefaultProps> = ({ }) => {
    const [helmCharts, setHelmCharts] = React.useState([]);
    const [filteredHelmCharts, setFilteredHelmCharts] = React.useState([]);
    const [searchValue, setSearchValue] = React.useState('');
    const [error, setError] = React.useState('');
    const [themeKind, setThemeKind] = React.useState(0);

    React.useEffect(() => {
        return VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'getHelmCharts') {
                if (message.data.errorMessage && message.data.errorMessage.length > 0) {
                    setError(message.data.errorMessage);
                    setHelmCharts(undefined);
                    setSearchValue('');
                } else {
                    setError('');
                    setSearchValue('');
                    setThemeKind(message.data.themeValue);
                    setHelmCharts(message.data.helmRes);
                    setFilteredHelmCharts(getFilteredCompDesc(message.data.helmRes, searchValue));
                }
            } else if (message.data.action === 'loadingComponents') {
                setError('');
                setSearchValue('');
                setFilteredHelmCharts(undefined);
                setHelmCharts(undefined);
            } else if (message.data.action === 'setTheme') {
                setThemeKind(message.data.themeValue);
            }
        });
    });

    return (
        <>
            {
                filteredHelmCharts.length > 0 || searchValue.length > 0 ?
                    <>
                        <SearchBar onSearchBarChange={function (value: string): void {
                            setSearchValue(value);
                            setFilteredHelmCharts(getFilteredCompDesc(helmCharts, value));
                        }} searchBarValue={searchValue} />
                        <HomeItem helmEntries={filteredHelmCharts} themeKind={themeKind} />
                        {error?.length > 0 ? <ErrorPage message={error} /> : null}
                    </>
                    :
                    error?.length > 0 ? <ErrorPage message={error} /> : <LoadScreen title='Loading Helm Charts' />
            }
        </>
    );
}

function getFilteredCompDesc(helmCharts: ChartResponse[], searchValue: string): ChartResponse[] {
    const filteredCharts: ChartResponse[] = [];
    const helmResponse = helmCharts.filter(function (helmChart: ChartResponse) {
        if (searchValue !== '') {
            return helmChart.displayName?.toLowerCase().indexOf(searchValue.toLowerCase()) !== -1 ||
                helmChart.chartVersions[0].name.toLowerCase().indexOf(searchValue.toLowerCase()) !== -1;
        }
        return helmChart;
    });
    filteredCharts.push(...helmResponse);
    return filteredCharts.sort(ascName);
}

function ascName(oldChart: ChartResponse, newChart: ChartResponse) {
    return oldChart.displayName.localeCompare(newChart.displayName);
}
