/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { SearchRounded, CloseRounded } from '@mui/icons-material';
import { Container, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { makeStyles } from '@mui/styles';
import * as React from 'react';
import './common.scss';
import { SearchBarProps } from './propertyTypes';
import searchBarStyle from './searchBar.style';

const useSearchBarStyle = makeStyles(searchBarStyle);

export const SearchBar: React.FC<SearchBarProps> = ({
    title,
    onSearchBarChange,
    searchBarValue,
    resultCount
}: SearchBarProps) => {
    const searchBarStyle = useSearchBarStyle();
    const icon = searchBarValue.length > 0 ?
        <InputAdornment position='end'>
            <IconButton aria-label='close' onClick={(): void => onSearchBarChange('')}>
                <CloseRounded />
            </IconButton>
        </InputAdornment> : undefined;
    return (
        <Container maxWidth='md'>
            <div className={searchBarStyle.searchBarContainer}>
                <TextField
                    className={searchBarStyle.searchBarInput}
                    placeholder={title}
                    value={searchBarValue}
                    onChange={(e) => {
                        onSearchBarChange(e.target.value);
                    }}
                    sx={{
                        '& fieldset': { border: 'none' }
                    }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position='start'>
                                <SearchRounded />
                            </InputAdornment >
                        ),
                        endAdornment: (icon)
                    }}
                    style={{
                        border: 'none',
                        borderRadius: '1rem'
                    }}
                />
                <Typography variant='caption' style={{ paddingTop: '0.2rem', fontSize: '0.7rem' }}>
                    {resultCount > 0 ? `1-${resultCount} of ${resultCount}` : 'No results found'}
                </Typography>
            </div>
        </Container>
    );
};
