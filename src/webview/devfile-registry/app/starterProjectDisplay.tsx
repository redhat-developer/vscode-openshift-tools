/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Text, TextContent } from '@patternfly/react-core';
import React from 'react';
import { StarterProject } from '../../../odo/componentTypeDescription';
import { DefaultProps } from './home';

interface StarterProjectDisplayProps extends DefaultProps {
    project: StarterProject;
    projectDisplayStyle: any;
}

export const StarterProjectDisplay: React.FC<StarterProjectDisplayProps> = ({
    project,
    projectDisplayStyle
}: StarterProjectDisplayProps) => (
    <TextContent>
        <Text data-testid='display-hovered-project-name' className={projectDisplayStyle.displayedName}>
            {project.name}
        </Text>
        <Text data-testid='display-hovered-project-description' className={projectDisplayStyle.displayedDescription}>
            {project.description}
        </Text>
    </TextContent>
);
