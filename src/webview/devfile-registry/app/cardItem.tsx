/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import React from "react";
import { Brand, Card, CardBody, CardHeader, CardTitle, TextContent, TextVariants, Text } from "@patternfly/react-core";
import { DevFileProps } from "./wrapperCardItem";

export const CardItem: React.FC<DevFileProps> = ({
    devFile,
    style,
}: DevFileProps) => {

    return (
        <>
            <Card
                className={style.card}
                isHoverable
                data-testid={`card-${devFile.name.replace(/\.| /g, '')}`}
            >
                <CardHeader className={style.cardHeader}>
                    <div className={style.cardHeaderDisplay}>
                        <Brand
                            src={devFile.icon}
                            alt={`${devFile.name} icon`}
                            className={style.cardImage}
                        />
                        <TextContent>
                            <Text className={style.text}>
                                {capitalizeFirstLetter(devFile.type)}
                            </Text>
                        </TextContent>
                    </div>
                </CardHeader>
                <CardTitle style={{ margin: '0.5rem' }}>
                    <TextContent>
                        <Text component={TextVariants.h3}>{devFile.displayName}</Text>
                    </TextContent>
                </CardTitle>
                <CardBody className={style.cardBody}>
                    {devFile.version && (
                        <TextContent>
                            <Text component={TextVariants.small}>
                                Version: {devFile.version}
                            </Text>
                        </TextContent>
                    )}
                    <TextContent>
                        <Text component={TextVariants.small}>
                            Language: {capitalizeFirstLetter(devFile.language)}
                        </Text>
                    </TextContent>
                    <TextContent>
                        <Text
                            component={TextVariants.p}
                            className={style.longDescription}
                        >
                            {devFile.description}
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
