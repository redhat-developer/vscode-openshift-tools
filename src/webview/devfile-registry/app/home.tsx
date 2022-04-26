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
import { Data, StarterProject } from '../../../odo/componentTypeDescription';
import { ComponentTypeAdapter } from '../../../odo/componentType';
import { SearchBar } from './searchBar';
import homeStyle from './home.style';
import cardItemStyle from './cardItem.style';
import starterProjectDisplayStyle from './starterProjectDisplay.style';

const useHomeStyles = makeStyles(homeStyle);
const starterProjectDisplayStyles = makeStyles(starterProjectDisplayStyle);
const useCardItemStyles = makeStyles(cardItemStyle);

interface HomePageProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    devFiles: Data[];
    components: ComponentTypeAdapter[];
}

export interface DefaultProps {
    analytics?: import('@segment/analytics-next').Analytics;
}

const HomeItem: React.FC<HomePageProps> = ({
    devFiles,
    components
}: HomePageProps) => {
    const homeStyleClass = useHomeStyles();
    const cardItemStyle = useCardItemStyles();
    const projectDisplayStyle = starterProjectDisplayStyles();
    return (
        <>
            <Gallery className={homeStyleClass.devfileGalleryGrid}>
                {
                    devFiles.map((devFile: Data, key: number) => (
                        <CardItem key={key} devFile={devFile} component={components[key]}
                            cardItemStyle={cardItemStyle} projectDisplayStyle={projectDisplayStyle} hasGitLink={hasGitLink(devFile)} />
                    ))
                }
            </Gallery>
        </>
    );
};

export function Home() {

    const [{ devfiles, filteredDevFiles, components, filteredComponents }, setData] = React.useState({
        devfiles: [],
        filteredDevFiles: [],
        components: [],
        filteredComponents: []
    });

    const [searchValue, setSearchValue] = React.useState('')

    React.useEffect(() => {
        return VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'getAllComponents') {
                setData(
                    {
                        devfiles: message.data.devFiles,
                        filteredDevFiles: [],
                        components: message.data.components,
                        filteredComponents: []
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
                            setSearchValue(value);
                            if (value !== '') {
                                let filteredDevFiles = devfiles.filter(function (devFile: Data) {
                                    return devFile.metadata.displayName?.toLowerCase().indexOf(value.toLowerCase()) !== -1 ||
                                        devFile.metadata.description?.toLowerCase().indexOf(value.toLowerCase()) !== -1;
                                });
                                let filteredComponents = components.filter(function (component: ComponentTypeAdapter) {
                                    return component.name.toLowerCase().indexOf(value.toLowerCase()) !== -1 ||
                                        component.description.toLowerCase().indexOf(value.toLowerCase()) !== -1;
                                });
                                setData(
                                    {
                                        devfiles: devfiles,
                                        filteredDevFiles: filteredDevFiles,
                                        components: components,
                                        filteredComponents: filteredComponents
                                    });
                            } else {
                                setData(
                                    {
                                        devfiles: devfiles,
                                        filteredDevFiles: [],
                                        components: components,
                                        filteredComponents: []
                                    });
                            }
                        }} searchBarValue={searchValue} />
                        <HomeItem devFiles={searchValue.length > 0 ? filteredDevFiles : devfiles}
                            components={searchValue.length > 0 ? filteredComponents : components} />
                    </> :
                    <LoadScreen />
            }
        </>
    );
}

function hasGitLink(devFile: Data): boolean {
    let hasGit = true;
    devFile.starterProjects.map((starterPro: StarterProject) => {
        hasGit = starterPro.git ? hasGit : false;
    });
    return hasGit;
}

