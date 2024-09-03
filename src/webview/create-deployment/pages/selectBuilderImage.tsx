/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Close, Search } from '@mui/icons-material';
import {
    Button,
    Divider,
    IconButton,
    InputAdornment,
    Pagination,
    Stack,
    TextField,
    Theme,
    Typography} from '@mui/material';
import * as React from 'react';
import { BuilderImage } from '../../common/buildImage';
import { LoadScreen } from '../../common/loading';
import { BuilderImageListItem } from '../../common/builderImageListItem';
import { every } from 'lodash';

// in order to add custom named colours for use in Material UI's `color` prop,
// you need to use module augmentation.
// see https://mui.com/material-ui/customization/palette/#typescript
declare module '@mui/material/SvgIcon' {
    interface SvgIconPropsColorOverrides {
        textSecondary: true;
    }
}

function SearchBar(props: {
    searchText: string;
    setSearchText: React.Dispatch<React.SetStateAction<string>>;
    numPages: number;
    currentPage: number;
    setCurrentPage: (i: number) => void;
    perPageCount: number;
    builderImagesLength: number;
}) {
    return (
        <Stack direction="row" alignItems="center" width="100%" justifyContent="space-between">
            <TextField
                variant="outlined"
                placeholder='Search'
                margin='normal'
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start" sx={{ marginTop: '0px !important' }}>
                            <Search color="textSecondary" fontSize='small' />
                        </InputAdornment>
                    ),
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton onClick={() => props.setSearchText('')}>
                                <Close color="textSecondary" fontSize='small' />
                            </IconButton>
                        </InputAdornment>
                    ),
                    disableUnderline: true
                }}
                value={props.searchText}
                sx={{ flexGrow: '1', maxWidth: '650px', py: 0, background: 'rgba(127, 127, 127, 8%)' }}
                onChange={(event) => {
                    props.setSearchText(event.target.value.toLowerCase());
                }}
            />
            <Stack direction="column" justifyContent="space-between" marginTop={0.5} gap={0.5}>
                <Pagination
                    count={props.numPages}
                    page={props.currentPage}
                    onChange={(_event, value: number) => {
                        props.setCurrentPage(value);
                    }}
                />
                <Typography align="center" flexGrow="1">
                    Showing items {(props.currentPage - 1) * props.perPageCount + 1} -{' '}
                    {Math.min(props.currentPage * props.perPageCount, props.builderImagesLength)} of{' '}
                    {props.builderImagesLength}
                </Typography>
            </Stack>
        </Stack>
    );
}

export type BuilderImageProps = {
    titleText: string;

    /**
     * The callback to run when the user selects a Builder Image.
     *
     * In order to avoid showing the template project selector,
     * write a callback that removes the BuilderImage search component from the page.
     */
    setSelectedBuilderImage?: (selected: BuilderImage) => void;

    setBuilderImages: BuilderImage[];

    /**
     * The function to step backwards in the UI.
     */
    goBack?: () => void;

    theme?: Theme;
};

export function SelectBuilderImage(props: BuilderImageProps) {
    const ITEMS_PER_PAGE = 10;

    const [selectedBuilderImage, setSelectedBuilderImage] = React.useState<BuilderImage>();
    const [currentPage, setCurrentPage] = React.useState(1);
    const [searchText, setSearchText] = React.useState('');

    React.useEffect(() => {
        setCurrentPage((_) => 1);
    }, [searchText]);

    React.useEffect(() => {
        props.setSelectedBuilderImage(selectedBuilderImage);
    }, [selectedBuilderImage]);

    if (!props.setBuilderImages || props.setBuilderImages.length <= 0) {
        return <LoadScreen title="Retrieving list of build image" />;
    }

    const builderImages: BuilderImage[] = props.setBuilderImages
        .filter((builderImage) => {
            const searchTerms = searchText.split(/\s+/);
            return every(
                searchTerms.map(
                    (searchTerm) =>
                        builderImage.name.toLowerCase().includes(searchTerm) ||
                        builderImage.displayName.toLowerCase().includes(searchTerm)
                ),
            );
        });

    return (
        <>
            <Stack direction="column" height="100%" spacing={0.5}>
                <Stack direction="row" spacing={1} width={'100%'}>
                    <Stack direction="column" sx={{ flexGrow: '1' }} spacing={1} width={'70%'}>
                        <SearchBar
                            searchText={searchText}
                            setSearchText={setSearchText}
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            numPages={
                                Math.floor(builderImages.length / ITEMS_PER_PAGE) +
                                (builderImages.length % ITEMS_PER_PAGE > 0.0001 ? 1 : 0)
                            }
                            perPageCount={ITEMS_PER_PAGE}
                            builderImagesLength={builderImages.length}
                        />
                        <Stack
                            id="buildImageList"
                            direction="column"
                            sx={{ height: 'calc(100vh - 140px)', overflow: 'scroll' }}
                            divider={<Divider />}
                            width={'100%'}
                        >
                            {builderImages
                                .slice(
                                    (currentPage - 1) * ITEMS_PER_PAGE,
                                    Math.min(currentPage * ITEMS_PER_PAGE, props.setBuilderImages.length),
                                )
                                .map((builderImage) => {
                                    return (
                                        <BuilderImageListItem
                                        key={`${builderImage.name}-${builderImage.displayName}`}
                                            builderImage={builderImage}
                                            buttonCallback={() => {
                                                setSelectedBuilderImage(builderImage);
                                            }}
                                        />
                                    );
                                })}
                        </Stack>
                    </Stack>
                </Stack>
                <Stack direction="row-reverse" justifyContent="space-between" alignItems="center">
                    {props.goBack && (
                        <Button
                            variant="outlined"
                            onClick={(_) => {
                                props.goBack();
                            }}
                        >
                            Back
                        </Button>
                    )}
                </Stack>
            </Stack>
        </>
    );
}
