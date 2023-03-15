/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { ImageList, ImageListItem, ThemeProvider } from '@mui/material';
import { makeStyles } from '@mui/styles';
import React, { ChangeEvent } from 'react';
import { Registry } from '../../../odo/componentType';
import { StarterProject } from '../../../odo/componentTypeDescription';
import { ErrorPage } from '../../common/errorPage';
import { HomeTheme } from '../../common/home.style';
import { LoadScreen } from '../../common/loading';
import { CompTypeDesc, DefaultProps, DevfileHomePageProps } from '../../common/propertyTypes';
import { SearchBar } from '../../common/searchBar';
import { VSCodeMessage } from '../vsCodeMessage';
import cardItemStyle from '../../common/cardItem.style';
import { FilterElements } from './filterElements';
import { WrapperCardItem as CardItem } from './wrapperCardItem';

const useCardItemStyles = makeStyles(cardItemStyle);

const HomeItem: React.FC<DevfileHomePageProps> = ({
    compDescriptions,
    themeKind
}: DevfileHomePageProps) => {
    const cardItemStyle = useCardItemStyles();
    return (
        <ThemeProvider theme={HomeTheme}>
            <ImageList className='devfileGalleryGrid' cols={4}>
                {
                    compDescriptions.map((compDescription: CompTypeDesc, key: number) => (
                        <ImageListItem key={`imageList-` + key}>
                            <CardItem key={key} compDescription={compDescription}
                                cardItemStyle={cardItemStyle} hasGitLink={hasGitLink(compDescription)}
                                themeKind={themeKind} />
                        </ImageListItem>
                    ))
                }
            </ImageList>
        </ThemeProvider>
    );
};

export const Home: React.FC<DefaultProps> = ({ }) => {
    const [compDescriptions, setCompDescriptions] = React.useState([]);
    const [filteredcompDescriptions, setFilteredcompDescriptions] = React.useState([]);
    const [registries, setRegistries] = React.useState([]);
    const [searchValue, setSearchValue] = React.useState('');
    const [error, setError] = React.useState('');
    const [themeKind, setThemeKind] = React.useState(0);

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
                    setThemeKind(message.data.themeValue);
                    setCompDescriptions(message.data.compDescriptions);
                    setRegistries(message.data.registries);
                    setFilteredcompDescriptions(getFilteredCompDesc(message.data.registries, message.data.compDescriptions, searchValue));
                }
            } else if (message.data.action === 'loadingComponents') {
                setError('');
                setFilteredcompDescriptions([]);
                setCompDescriptions([]);
                setSearchValue('');
            } else if (message.data.action === 'setTheme') {
                setThemeKind(message.data.themeValue);
            }
        });
    });

    return (
        <>
            {
                filteredcompDescriptions.length > 0 || searchValue.length > 0 ?
                    <>
                        <SearchBar title='Search registry by name or description' onSearchBarChange={function (value: string): void {
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
                        <HomeItem compDescriptions={filteredcompDescriptions} themeKind={themeKind} />
                        {error?.length > 0 ? <ErrorPage message={error} /> : null}
                    </>
                    :
                    error?.length > 0 ? <ErrorPage message={error} /> : <LoadScreen title='Loading Registry View'/>
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

