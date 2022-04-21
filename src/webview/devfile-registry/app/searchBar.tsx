/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { makeStyles } from '@material-ui/core';
import { Text, TextContent, TextVariants, SearchInput } from '@patternfly/react-core';
import React from 'react';
import searchBarStyle from './searchBar.style';

const useSearchBarStyle = makeStyles(searchBarStyle);

interface SearchBarProps extends DefaultProps {
    devfileCount: number;
    onSearchBarChange: (value: string) => void;
    searchBarValue: string;
}

interface DefaultProps {
    analytics?: import('@segment/analytics-next').Analytics;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    devfileCount,
    onSearchBarChange,
    searchBarValue
}: SearchBarProps) => {
    const searchBarStyle = useSearchBarStyle();
    return (
        <div className={searchBarStyle.searchBar}>
            <TextContent className={searchBarStyle.searchBarText}>
                <Text component={TextVariants.h2}>Search</Text>
            </TextContent>
            <SearchInput
                data-testid="search-bar-devfile"
                className={searchBarStyle.searchBarInput}
                placeholder="Search by name, tag, provider or description"
                value={searchBarValue}
                onChange={onSearchBarChange}
                onClear={(): void => onSearchBarChange('')}
                resultsCount={devfileCount}
            />
        </div>
    );
};
