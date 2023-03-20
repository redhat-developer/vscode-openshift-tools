/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Typography } from '@mui/material';
import { makeStyles } from '@mui/styles';
import * as React from 'react';
import { StarterProjectDisplayProps } from './propertyTypes';

import starterProjectDisplayStyle from './starterProjectDisplay.style';

const useProjectStyles = makeStyles(starterProjectDisplayStyle);

export const StarterProjectDisplay: React.FC<StarterProjectDisplayProps> = ({
    project
}: StarterProjectDisplayProps) => {
    const projectDisplayStyle = useProjectStyles();
    return (
        <div>
            <Typography data-testid='display-hovered-project-name' className={projectDisplayStyle.displayedName}>
                {project.name}
            </Typography>
            <Typography data-testid='display-hovered-project-description' variant='caption' className={projectDisplayStyle.displayedDescription}>
                {project.description}
            </Typography>
        </div>
    );
};
