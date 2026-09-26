/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Typography } from '@mui/material';
import * as React from 'react';
import { StarterProjectDisplayProps } from './propertyTypes';

import starterProjectDisplayStyle from './starterProjectDisplay.style';

export const StarterProjectDisplay: React.FC<StarterProjectDisplayProps> = ({
    project
}: StarterProjectDisplayProps) => {
    return (
        <div>
            <Typography data-testid='display-hovered-project-name' sx={starterProjectDisplayStyle.displayedName}>
                {project.name}
            </Typography>
            <Typography data-testid='display-hovered-project-description' variant='caption' sx={starterProjectDisplayStyle.displayedDescription}>
                {project.description}
            </Typography>
        </div>
    );
};
