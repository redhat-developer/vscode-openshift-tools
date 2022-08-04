/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import React, { ChangeEvent } from 'react';
import { Text, TextContent } from '@patternfly/react-core';
import { DefaultProps } from './home';
import {
    Registry
} from './../../../odo/componentType';
import { makeStyles } from '@material-ui/styles';
import filterElementsStyle from './filterElements.style';
import { Checkbox, FormControlLabel } from '@material-ui/core';
import { Tooltip } from '@mui/material';

interface FilterProps extends DefaultProps {
    id: string,
    registries: Registry[],
    onCheckBoxChange: (event: ChangeEvent<HTMLInputElement>, checked: boolean) => void;
}

const filterStyle = makeStyles(filterElementsStyle);

export const FilterElements: React.FC<FilterProps> = ({
    id,
    registries,
    onCheckBoxChange
}: FilterProps) => {
    const filterStyleCSS = filterStyle();
    return (
        <div className={filterStyleCSS.filterContainer}>
            <TextContent>
                <Text style={{ fontSize: 'var(--vscode-editor-font-size)' }}>Registries:</Text>
            </TextContent>
            {
                registries.map((registry, index) => (
                    <FormControlLabel className={filterStyleCSS.checkBoxItem} key={registry.Name + '-' + index}
                        control={
                            <Checkbox id={`${id}-${registry.Name}`}
                                className={filterStyleCSS.checkbox}
                                onChange={onCheckBoxChange}
                                name={registry.Name}
                                checked={registry.state}
                                key={registry.Name + '-' + index}
                                color='primary'
                                size='medium' />
                        }
                        label={<Tooltip title={registry.URL} arrow><span style={{ fontSize: 'var(--vscode-editor-font-size)' }}>{registry.Name}</span></Tooltip>}
                        labelPlacement='end'
                        style={{ padding: '0px', marginBottom: '0px' }} />
                ))
            }
        </div>
    );
}
