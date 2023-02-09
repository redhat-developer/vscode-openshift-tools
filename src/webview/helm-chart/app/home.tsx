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

const useHomeStyles = makeStyles(homeStyle);
const starterProjectDisplayStyles = makeStyles(starterProjectDisplayStyle);
const useCardItemStyles = makeStyles(cardItemStyle);

interface HomePageProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    helmEntries: object;
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
                Object.keys(helmEntries).map((key, index) => (
                    <ImageListItem key={`imageList-` + index}>
                        <CardItem key={key} chartName={key} helmEntry={helmEntries[key].reverse()}
                            cardItemStyle={cardItemStyle} projectDisplayStyle={projectDisplayStyle}
                            themeKind={themeKind} />
                    </ImageListItem>
                ))
            }
        </ImageList>
    );
};

export const Home: React.FC<DefaultProps> = ({ }) => {
    const [helmCharts, setHelmCharts] = React.useState(undefined);
    const [filteredHelmCharts, setFilteredHelmCharts] = React.useState(undefined);
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
                    setHelmCharts(message.data.helmCharts);
                    setFilteredHelmCharts(getFilteredCompDesc(message.data.helmCharts, searchValue));
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
                filteredHelmCharts || searchValue.length > 0 ?
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

function getFilteredCompDesc(helmCharts: object, searchValue: string): object {
    if (searchValue === '') {
        return Object.fromEntries(Object.entries(helmCharts).sort(ascName));
    }
    return Object.fromEntries(Object.entries(helmCharts).filter(([key]) => {
        return key.toLowerCase().indexOf(searchValue.toLowerCase()) !== -1
    }
    ).sort(ascName));
}

function ascName(oldIndex, newIndex) {
    const oldHelmChart = oldIndex[1];
    const newHelmChart = newIndex[1];
    const oldName = oldHelmChart[0].annotations['charts.openshift.io/name'] || oldHelmChart[0].name;
    const newName = newHelmChart[0].annotations['charts.openshift.io/name'] || newHelmChart[0].name;
    return oldName.localeCompare(newName);
}
