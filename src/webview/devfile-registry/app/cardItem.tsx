/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import React from 'react';
import { Brand, Card, CardBody, CardHeader, CardTitle, TextContent, TextVariants, Text } from '@patternfly/react-core';
import { DevFileProps } from './wrapperCardItem';
import { VSCodeMessage } from '../vsCodeMessage';

export const CardItem: React.FC<DevFileProps> = ({
    devFile,
    style
}: DevFileProps) => {

    const onTileClick = (): void => {
        VSCodeMessage.postMessage({'action':'getYAML','data': devFile});
    };

    return (
        <>
            <Card
                className={style.card}
                isHoverable
                onClick={onTileClick}
                data-testid={`card-${devFile.metadata.name.replace(/\.| /g, '')}`}
            >
                <CardHeader className={style.cardHeader}>
                    <div className={style.cardHeaderDisplay}>
                        <Brand
                            src={devFile.metadata.icon}
                            alt={`${devFile.metadata.name} icon`}
                            className={style.cardImage}
                        />
                        {/* TODO: needs to check <TextContent>
                            <Text className={style.text}>
                                {capitalizeFirstLetter(devFile.metadata.projectType)}
                            </Text>
                        </TextContent>*/}
                    </div>
                </CardHeader>
                <CardTitle style={{ margin: '0.5rem' }}>
                    <TextContent>
                        <Text component={TextVariants.h3}>{devFile.metadata.displayName}</Text>
                    </TextContent>
                </CardTitle>
                <CardBody className={style.cardBody}>
                    {devFile.metadata.version && (
                        <TextContent>
                            <Text component={TextVariants.small}>
                                Version: {devFile.metadata.version}
                            </Text>
                        </TextContent>
                    )}
                    <TextContent>
                        <Text component={TextVariants.small}>
                            Language: {capitalizeFirstLetter(devFile.metadata.language)}
                        </Text>
                    </TextContent>
                    <TextContent>
                        <Text
                            component={TextVariants.p}
                            className={style.longDescription}
                        >
                            {devFile.metadata.description}
                        </Text>
                    </TextContent>
                </CardBody>
            </Card>
        </>
    );
}


function capitalizeFirstLetter(value: string): string {
    return value[0].toUpperCase() + value.substring(1);
}
