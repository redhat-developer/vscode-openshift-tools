/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Checkbox, FormControl, ListItemText, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import React from 'react';
import { FilterProps } from '../../common/propertyTypes';
import { Registry } from '../../../odo/componentType';
import { isDefaultDevfileRegistry } from './home';

export const FilterElements: React.FC<FilterProps> = ({
    id,
    registries,
    onCheckBoxChange
}: FilterProps) => {

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
        <FormControl sx={{ margin: '2rem 0 2rem 2rem', width: 300 }}>
            <Select
                id='multiple-checkbox'
                autoWidth
                multiple
                value={registryName}
                onChange={handleChange}
                renderValue={() => ['All Devfiles']}
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
