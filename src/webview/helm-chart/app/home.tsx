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

const useHomeStyles = makeStyles(homeStyle);
const starterProjectDisplayStyles = makeStyles(starterProjectDisplayStyle);
const useCardItemStyles = makeStyles(cardItemStyle);

interface HomePageProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    helmEntries: any[];
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
                helmEntries.map((helmEntry: any, key: number) => (
                    <ImageListItem key={`imageList-` + key}>
                        <CardItem key={key} helmEntry={helmEntry}
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
    const [error, setError] = React.useState('');
    const [themeKind, setThemeKind] = React.useState(0);

    React.useEffect(() => {
        return VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'getHelmCharts') {
                if (message.data.errorMessage && message.data.errorMessage.length > 0) {
                    setError(message.data.errorMessage);
                    setHelmCharts([]);
                } else {
                    setError('');
                    setThemeKind(message.data.themeValue);
                    setHelmCharts(message.data.helmCharts);
                }
            } else if (message.data.action === 'loadingComponents') {
                setError('');
                setHelmCharts([]);
            } else if (message.data.action === 'setTheme') {
                setThemeKind(message.data.themeValue);
            }
        });
    });

    return (
        <>
            {
                helmCharts.length > 0 ?
                    <>
                        <HomeItem helmEntries={helmCharts} themeKind={themeKind} />
                        {error?.length > 0 ? <ErrorPage message={error} /> : null}
                    </>
                    :
                    error?.length > 0 ? <ErrorPage message={error} /> : <LoadScreen />
            }
        </>
    );
}

