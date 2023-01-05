/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React, { ChangeEvent } from 'react';
import { makeStyles } from '@material-ui/core';
import { WrapperCardItem as CardItem } from './wrapperCardItem';
import { LoadScreen } from './loading';
import { VSCodeMessage } from '../vsCodeMessage';
import { StarterProject } from '../../../odo/componentTypeDescription';
import { SearchBar } from './searchBar';
import homeStyle from './home.style';
import cardItemStyle from './cardItem.style';
import starterProjectDisplayStyle from './starterProjectDisplay.style';
import { FilterElements } from './filterElements';
import { ComponentTypeDescription, Registry } from '../../../odo/componentType';
import { ErrorPage } from './errorPage';
import { ImageList, ImageListItem } from '@mui/material';

const useHomeStyles = makeStyles(homeStyle);
const starterProjectDisplayStyles = makeStyles(starterProjectDisplayStyle);
const useCardItemStyles = makeStyles(cardItemStyle);

interface CompTypeDesc extends ComponentTypeDescription {
    priority: number;
}

interface HomePageProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    compDescriptions: CompTypeDesc[];
}

export interface DefaultProps {
    analytics?: import('@segment/analytics-next').Analytics;
}

const HomeItem: React.FC<HomePageProps> = ({
    compDescriptions
}: HomePageProps) => {
    const homeStyleClass = useHomeStyles();
    const cardItemStyle = useCardItemStyles();
    const projectDisplayStyle = starterProjectDisplayStyles();
    return (
        <ImageList className={homeStyleClass.devfileGalleryGrid} cols={4}>
            {
                compDescriptions.map((compDescription: CompTypeDesc, key: number) => (
                    <ImageListItem key={`imageList-`+key}>
                        <CardItem key={key} compDescription={compDescription}
                            cardItemStyle={cardItemStyle} projectDisplayStyle={projectDisplayStyle} hasGitLink={hasGitLink(compDescription)} />
                    </ImageListItem>
                ))
            }
        </ImageList>
    );
};

export const Home: React.FC<DefaultProps> = ({ }) => {
    const [compDescriptions, setCompDescriptions] = React.useState([]);
    const [filteredcompDescriptions, setFilteredcompDescriptions] = React.useState([]);
    const [registries, setRegistries] = React.useState([]);
    const [searchValue, setSearchValue] = React.useState('');
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        return VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'getAllComponents') {
                if (message.data.errorMessage && message.data.errorMessage.length > 0) {
                    setError(message.data.errorMessage);
                    setCompDescriptions([]);
                    setRegistries([]);
                    setFilteredcompDescriptions([]);
                } else {
                    setError('');
                    if (message.data.registries.length === 1) {
                        message.data.registries.map((registry: Registry) => {
                            registry.state = true;
                        });
                    } else {
                        message.data.registries.map((registry: Registry) => {
                            if (registry.url.toLowerCase().indexOf('https://registry.devfile.io') !== -1) {
                                registry.state = true;
                            }
                        });
                    }
                    setCompDescriptions(message.data.compDescriptions);
                    setRegistries(message.data.registries);
                    setFilteredcompDescriptions(getFilteredCompDesc(message.data.registries, message.data.compDescriptions, searchValue));
                }
            } else if (message.data.action === 'loadingComponents') {
                setError('');
                setFilteredcompDescriptions([]);
                setCompDescriptions([]);
                setSearchValue('');
            }
        });
    });

    return (
        <>
            {
                filteredcompDescriptions.length > 0 || searchValue.length > 0 ?
                    <>
                        <SearchBar onSearchBarChange={function (value: string): void {
                            setSearchValue(value);
                            setFilteredcompDescriptions(getFilteredCompDesc(registries, compDescriptions, value));
                        }} searchBarValue={searchValue} />
                        {
                            registries.length > 1 &&
                            <FilterElements id='registry'
                                registries={registries}
                                onCheckBoxChange={function (event: ChangeEvent<HTMLInputElement>, _checked: boolean): void {
                                    const target: EventTarget = event.target;
                                    const state: boolean = (target as HTMLInputElement).checked;
                                    const value: string = (target as HTMLInputElement).name;
                                    const filteredRegistries = registries.map((filteredRegistry) => {
                                        if (filteredRegistry.Name === value) {
                                            filteredRegistry.state = state;
                                        }
                                        return filteredRegistry;
                                    });
                                    const allUncheckedRegistries = filteredRegistries.filter((registry: Registry) => !registry.state);
                                    if (allUncheckedRegistries.length === registries.length) {
                                        allUncheckedRegistries.map((uncheckedRegistry: Registry) => {
                                            if (uncheckedRegistry.url.toLowerCase().indexOf('https://registry.devfile.io') !== -1) {
                                                uncheckedRegistry.state = true;
                                            }
                                        })
                                    }
                                    setRegistries(filteredRegistries);
                                    setFilteredcompDescriptions(getFilteredCompDesc(filteredRegistries, compDescriptions, searchValue));
                                }}
                            />
                        }
                        <HomeItem compDescriptions={filteredcompDescriptions} />
                        {error?.length > 0 ? <ErrorPage message={error} /> : null}
                    </>
                    :
                    error?.length > 0 ? <ErrorPage message={error} /> : <LoadScreen />
            }
        </>
    );
}

function getFilteredCompDesc(registries: Registry[], compDescriptions: CompTypeDesc[], searchValue: string): CompTypeDesc[] {
    const filteredCompDesciptions: CompTypeDesc[] = [];
    registries.map((registry: Registry) => {
        const compDescrs = compDescriptions.filter(function (compDescription: CompTypeDesc) {
            if (compDescription.registry.name === registry.name && registry.state) {
                if (searchValue !== '') {
                    return compDescription.devfileData.devfile.metadata.displayName?.toLowerCase().indexOf(searchValue.toLowerCase()) !== -1 ||
                        compDescription.devfileData.devfile.metadata.description?.toLowerCase().indexOf(searchValue.toLowerCase()) !== -1;
                }
                return compDescription;
            }
        }).map((compDescription: CompTypeDesc) => {
            if (compDescription.devfileData.devfile.metadata.name === 'java-quarkus') {
                compDescription.priority = 3;
            } else if (compDescription.devfileData.devfile.metadata.name === 'nodejs') {
                compDescription.priority = 2;
            } else if (compDescription.devfileData.devfile.metadata.name.indexOf('python') !== -1) {
                compDescription.priority = 1;
            } else {
                compDescription.priority = -1;
            }
            return compDescription;
        });
        filteredCompDesciptions.push(...compDescrs);
    });
    return filteredCompDesciptions.sort(ascName);
}

function hasGitLink(compDescription: CompTypeDesc): boolean {
    let hasGit = true;
    compDescription.devfileData.devfile.starterProjects?.map((starterPro: StarterProject) => {
        hasGit = starterPro.git ? hasGit : false;
    });
    return hasGit;
}

function ascName(oldCompDesc: CompTypeDesc, newCompDesc: CompTypeDesc): number {
    if (oldCompDesc.priority < 0 && newCompDesc.priority < 0) {
        return oldCompDesc.devfileData.devfile.metadata.name.localeCompare(newCompDesc.devfileData.devfile.metadata.name);
    }
    return newCompDesc.priority - oldCompDesc.priority;
}

