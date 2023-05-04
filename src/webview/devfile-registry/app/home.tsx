/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Container, ImageListItem, ThemeProvider, createTheme, styled } from '@mui/material';
import { makeStyles } from '@mui/styles';
import React from 'react';
import { Registry } from '../../../odo/componentType';
import { StarterProject } from '../../../odo/componentTypeDescription';
import cardItemStyle from '../../common/cardItem.style';
import { ErrorPage } from '../../common/errorPage';
import homeStyle, { HomeTheme } from '../../common/home.style';
import { LoadScreen } from '../../common/loading';
import { CompTypeDesc, DefaultProps, DevfileHomePageProps } from '../../common/propertyTypes';
import { SearchBar } from '../../common/searchBar';
import { VSCodeMessage } from '../vsCodeMessage';
import { FilterElements } from './filterElements';
import { WrapperCardItem as CardItem } from './wrapperCardItem';

const useCardItemStyles = makeStyles(cardItemStyle);
const useHomeStyles = makeStyles(homeStyle);

const ImageGalleryList = styled('ul')(({ theme }) => ({
    display: 'grid',
    padding: 0,
    margin: theme.spacing(0, 4),
    gap: 1,
    [theme.breakpoints.up('xs')]: {
        gridTemplateColumns: 'repeat(1, 1fr)'
    },
    [theme.breakpoints.up('sm')]: {
        gridTemplateColumns: 'repeat(1, 1fr)'
    },
    [theme.breakpoints.between('sm', 'md')]: {
        gridTemplateColumns: 'repeat(1, 1fr)'
    },
    [theme.breakpoints.up('md')]: {
        gridTemplateColumns: 'repeat(2, 1fr)'
    },
    [theme.breakpoints.up('lg')]: {
        gridTemplateColumns: 'repeat(3, 1fr)'
    },
    [theme.breakpoints.up('xl')]: {
        gridTemplateColumns: 'repeat(4, 1fr)'
    }
}));

const HomeItem: React.FC<DevfileHomePageProps> = ({
    compDescriptions,
    themeKind
}: DevfileHomePageProps) => {
    const cardItemStyle = useCardItemStyles();
    // represents the Material UI theme currently being used by this webview
    const theme = React.useMemo(
        () => {
            const computedStyle = window.getComputedStyle(document.body);
            return createTheme({
                palette: {
                    mode: themeKind === 1 ? 'light' : 'dark',
                    primary: {
                        main: computedStyle.getPropertyValue('--vscode-button-background'),
                    },
                    error: {
                        main: computedStyle.getPropertyValue('--vscode-editorError-foreground'),
                    },
                    warning: {
                        main: computedStyle.getPropertyValue('--vscode-editorWarning-foreground'),
                    },
                    info: {
                        main: computedStyle.getPropertyValue('--vscode-editorInfo-foreground'),
                    },
                    success: {
                        main: computedStyle.getPropertyValue('--vscode-debugIcon-startForeground'),
                    },
                },
                typography: {
                    allVariants: {
                        fontFamily: computedStyle.getPropertyValue('--vscode-font-family'),
                    },
                },
            });
        },
        [themeKind],
    );
    return (
        <ThemeProvider theme={HomeTheme}>
            <ImageGalleryList className='devfileGalleryGrid' style={{ margin: '1rem' }}>
                <ThemeProvider theme={theme}>
                {
                    compDescriptions.map((compDescription: CompTypeDesc, key: number) => (
                        <ImageListItem key={`imageList-` + key}>
                            <CardItem key={key} compDescription={compDescription}
                                cardItemStyle={cardItemStyle} hasGitLink={hasGitLink(compDescription)}
                                themeKind={themeKind} />
                        </ImageListItem>
                    ))
                }
                </ThemeProvider>
            </ImageGalleryList>
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
                    message.data.registries.forEach((registry: Registry) => {
                        registry.state = true;
                    });
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

    const homeStyle = useHomeStyles();

    return (
        <>
            {
                filteredcompDescriptions.length > 0 || searchValue.length > 0 ?
                    <>
                        <Container maxWidth='md'>
                            <div className={homeStyle.topContainer}>
                                {
                                    registries.length > 1 &&
                                    <FilterElements id='registry'
                                        registries={registries}
                                        onCheckBoxChange={function (values: string | string[]): void {
                                            if (Array.isArray(values)) {
                                                const filteredRegistries = values.length === 0 ? registries.filter((registry: Registry) => {
                                                    registry.state = isDefaultDevfileRegistry(registry.url) ? true : false;
                                                    return registry;
                                                }) : registries.filter((registry: Registry) => {
                                                    registry.state = values.includes(registry.name) ? true : false;
                                                    return registry;
                                                });
                                                setRegistries(filteredRegistries);
                                                setFilteredcompDescriptions(getFilteredCompDesc(filteredRegistries, compDescriptions, searchValue));
                                            }
                                        }}
                                    />
                                }
                                <SearchBar title='Search registry by name or description' onSearchBarChange={function (value: string): void {
                                    setSearchValue(value);
                                    setFilteredcompDescriptions(getFilteredCompDesc(registries, compDescriptions, value));
                                }} searchBarValue={searchValue} resultCount={filteredcompDescriptions.length} />
                            </div>
                        </Container>
                        <HomeItem compDescriptions={filteredcompDescriptions} themeKind={themeKind} />
                        {error?.length > 0 ? <ErrorPage message={error} /> : null}
                    </>
                    :
                    error?.length > 0 ? <ErrorPage message={error} /> : <LoadScreen title='Loading Registry View' />
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

export function isDefaultDevfileRegistry(registryUrl: string): boolean {
    const url = new URL(registryUrl);
    return url.hostname.toLowerCase() === 'registry.devfile.io';
}
