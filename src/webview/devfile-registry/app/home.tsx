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
import { SearchBar } from './searchBar';
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

    const [{ devfiles, filteredDevFiles, components }, setData] = React.useState({
        devfiles: [],
        filteredDevFiles: [],
        components: []
    });

    React.useEffect(() => {
        return VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'getAllComponents') {
                setData(
                    {
                        devfiles: message.data.devFiles,
                        filteredDevFiles: [],
                        components: message.data.components
                    }
                )
            }
        });
    });

    return (
        <>
            {
                devfiles.length > 0 ?
                    <>
                        <SearchBar onSearchBarChange={function (value: string): void {
                            if (value?.trim() !== '') {
                                let filteredDevFiles = devfiles.filter(function (devFile: Data) {
                                    return devFile.metadata.displayName?.toLowerCase().indexOf(value.toLowerCase()) !== -1 ||
                                     devFile.metadata.description?.toLowerCase().indexOf(value.toLowerCase()) !== -1;
                                });
                                setData(
                                    {
                                        devfiles: devfiles,
                                        filteredDevFiles: filteredDevFiles,
                                        components: components
                                    });
                            } else {
                                setData(
                                    {
                                        devfiles: devfiles,
                                        filteredDevFiles: [],
                                        components: components
                                    });
                            }
                        }} searchBarValue={''} />
                        <HomeItem devFiles={filteredDevFiles.length > 0 ? filteredDevFiles : devfiles} components={components} />
                    </> :
                    <LoadScreen />
            }
        </>
    );
}
