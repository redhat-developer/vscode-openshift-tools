/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { makeStyles } from '@material-ui/core';
import { DefaultProps } from './home';
import React from 'react';
import searchBarStyle from './searchBar.style';
import { SearchInput } from '@patternfly/react-core/dist/esm/components/SearchInput';

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
            <SearchInput
                data-testid='search-bar-devfile'
                className={searchBarStyle.searchBarInput}
                placeholder='Search by name or description'
                value={searchBarValue}
                onChange={onSearchBarChange}
                onClick={(): void => onSearchBarChange('')}
                onClear={(): void => onSearchBarChange('')}
            />
        </div>
    );
};
