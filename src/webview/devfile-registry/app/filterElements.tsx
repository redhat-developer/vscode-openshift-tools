/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import React, { ChangeEvent } from 'react';
import { DefaultProps } from './home';
import {
    Registry
} from './../../../odo/componentType';
import { makeStyles } from '@mui/styles';
import filterElementsStyle from './filterElements.style';
import { Checkbox, FormControlLabel } from '@material-ui/core';
import { Tooltip, Typography } from '@mui/material';

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
            <Typography style={{ fontSize: 'var(--vscode-editor-font-size)' }}>Registries:</Typography>
            {
                registries.map((registry, index) => (
                    <FormControlLabel className='checkBoxItem' key={registry.name + '-' + index}
                        control={
                            <Checkbox id={`${id}-${registry.name}`}
                                className='checkbox'
                                onChange={onCheckBoxChange}
                                name={registry.name}
                                checked={registry.state}
                                key={registry.name + '-' + index}
                                color='primary'
                                size='medium' />
                        }
                        label={<Tooltip title={registry.url} arrow><span style={{ fontSize: 'var(--vscode-editor-font-size)' }}>{registry.name}</span></Tooltip>}
                        labelPlacement='end'
                        style={{ padding: '0px', marginBottom: '0px' }} />
                ))
            }
        </div>
    );
}
