/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Typography } from '@mui/material';
import React from 'react';
import { DefaultProps } from './home';

interface StarterProjectDisplayProps extends DefaultProps {
    project: any;
    projectDisplayStyle: any;
}

export const StarterProjectDisplay: React.FC<StarterProjectDisplayProps> = ({
    project,
    projectDisplayStyle
}: StarterProjectDisplayProps) => (
    <div>
        <Typography data-testid='display-hovered-project-name' className={projectDisplayStyle.displayedName}>
            {project.name}
        </Typography>
        <Typography data-testid='display-hovered-project-description' variant='caption' className={projectDisplayStyle.displayedDescription}>
            {project.description}
        </Typography>
    </div>
);
