/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Checkbox, FormControl, InputLabel, ListItemText, MenuItem, OutlinedInput, Select, SelectChangeEvent } from '@mui/material';
import React from 'react';
import { FilterProps } from '../../common/propertyTypes';
import { Registry } from '../../../odo/componentType';
import { isDefaultDevfileRegistry } from 'home';

export const FilterElements: React.FC<FilterProps> = ({
    id,
    registries,
    onCheckBoxChange
}: FilterProps) => {

    const ITEM_HEIGHT = 48;
    const ITEM_PADDING_TOP = 8;
    const MenuProps = {
        PaperProps: {
            style: {
                maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
                width: 250,
            },
        },
    };

    const [registryName, setRegistryName] = React.useState<string[]>(getRegistryNames(registries));

    const handleChange = (event: SelectChangeEvent<typeof registryName>) => {
        const {
            target: { value },
        } = event;
        if (value === '' || value.length === 0) {
            setRegistryName(getDefaultRegistryName(registries));
        } else {
            setRegistryName(
                typeof value === 'string' ? value.split(',') : value,
            );
        }
        onCheckBoxChange(event.target.value);
    };

    return (
        <FormControl sx={{ margin: '2rem 0 2rem 2rem', width: 400 }}>
            <InputLabel id='multiple-checkbox-label'>All Devfiles</InputLabel>
            <Select
                labelId='multiple-checkbox-label'
                id='multiple-checkbox'
                multiple
                value={registryName}
                onChange={handleChange}
                input={<OutlinedInput label='All Devfiles' />}
                renderValue={(selected) => selected.join(', ')}
                MenuProps={MenuProps}
                sx={{
                    '& fieldset': { border: 'none' }
                }}
                style={{
                    border: 'none'
                }}
            >
                {registries.map((registry, index) => (
                    <MenuItem key={registry.name} value={registry.name}>
                        <Checkbox id={`${id}-${registry.name}`}
                            className='checkbox'
                            name={registry.name}
                            checked={registry.state}
                            key={registry.name + '-' + index}
                            color='primary'
                            size='medium' />
                        <ListItemText primary={registry.name} />
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}

function getRegistryNames(registries: Registry[]): string[] {
    return registries.filter((registry) => registry.state).map((registry) => registry.name);
}

function getDefaultRegistryName(registries: Registry[]): string[] {
    return registries.filter((registry) => { if (isDefaultDevfileRegistry(registry.url)) return registry }).map((registry) => registry.name);
}
