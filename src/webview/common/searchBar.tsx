/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { SearchRounded } from '@mui/icons-material';
import { InputAdornment, TextField } from '@mui/material';
import { makeStyles } from '@mui/styles';
import * as React from 'react';
import './common.scss';
import { SearchBarProps } from './propertyTypes';
import searchBarStyle from './searchBar.style';

const useSearchBarStyle = makeStyles(searchBarStyle);

export const SearchBar: React.FC<SearchBarProps> = ({
    title,
    onSearchBarChange,
    searchBarValue
}: SearchBarProps) => {
    const searchBarStyle = useSearchBarStyle();
    return (
        <div className={searchBarStyle.searchBar}>
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
                onClick={(): void => onSearchBarChange('')}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position='start' style={{ paddingLeft: '0.0625rem' }}>
                            <SearchRounded />
                        </InputAdornment >
                    )
                }}
            />
        </div>
    );
};
