/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { makeStyles } from '@material-ui/core';
import { Gallery } from '@patternfly/react-core';
import { WrapperCardItem as CardItem } from './wrapperCardItem';
import { LoadScreen } from './loading';
import { VSCodeMessage } from '../vsCodeMessage';
import { Data } from '../../../odo/componentTypeDescription';
import { DevfileComponentType } from '../../../odo/componentType';
import homeStyle from './home.style';
import cardItemStyle from './cardItem.style';

const useHomeStyles = makeStyles(homeStyle);
const useCardItemStyles = makeStyles(cardItemStyle);

interface HomePageProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    devFiles: Data[];
    components: DevfileComponentType[];
}

const HomeItem: React.FC<HomePageProps> = ({
    devFiles,
    components
}: HomePageProps) => {
    const homeStyleClass = useHomeStyles();
    const cardItemStyle = useCardItemStyles();
    return (
        <>
            <Gallery className={homeStyleClass.devfileGalleryGrid}>
                {
                    devFiles.map((devFile, key) => (
                        <CardItem key={key} devFile={devFile} component={components[key]} cardItemStyle={cardItemStyle} />
                    ))
                }
            </Gallery>
        </>
    );
};

export function Home() {

    const [{ devfiles, components }, setData] = React.useState({
        devfiles: [],
        components: []
    });

    React.useEffect(() => {
        return VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'getAllComponents') {
                setData({
                    devfiles: message.data.devFiles,
                    components: message.data.components
                })
            }
        });
    });

    return (
        <div>
            {devfiles.length > 0 ? <HomeItem devFiles={devfiles} components={components} /> :
                <LoadScreen />}
        </div>
    );
}
