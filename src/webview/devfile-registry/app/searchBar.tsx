/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { SearchRounded } from '@mui/icons-material';
import { InputAdornment, TextField } from '@mui/material';
import { makeStyles } from '@mui/styles';
import React from 'react';
import { DefaultProps } from './home';
import searchBarStyle from './searchBar.style';
import './CardItemStyle.scss'

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
                sx={{
                    '& fieldset': { border: 'none' }
                }}
                onClick={(): void => onSearchBarChange('')}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position='start' style={{ paddingLeft: '0.0625rem' }}>
                            <SearchRounded />
                        </InputAdornment >
                    ),
                    disableUnderline: true
                }}
            />
        </div>
    );
};
