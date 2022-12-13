/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { makeStyles } from '@mui/styles';
import { InputAdornment, TextField } from '@material-ui/core';
import { SearchRounded } from '@material-ui/icons';
import { DefaultProps } from './home';
import React from 'react';
import searchBarStyle from './searchBar.style';

const useSearchBarStyle = makeStyles(searchBarStyle);

interface SearchBarProps extends DefaultProps {
    onSearchBarChange: (value: string) => void;
    searchBarValue: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    onSearchBarChange,
    searchBarValue
}: SearchBarProps) => {
    const searchBarStyle = useSearchBarStyle();
    return (
        <div className={searchBarStyle.searchBar}>
            <TextField
                className={searchBarStyle.searchBarInput}
                placeholder='Search registry by name or description'
                value={searchBarValue}
                onChange={(e) => {
                    onSearchBarChange(e.target.value);
                }}
                onClick={(): void => onSearchBarChange('')}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position='start' style={{ marginBottom: '0.0625rem', paddingLeft: '0.0625rem' }}>
                            <SearchRounded />
                        </InputAdornment >
                    ),
                    disableUnderline: true
                }}
            />
        </div>
    );
};
