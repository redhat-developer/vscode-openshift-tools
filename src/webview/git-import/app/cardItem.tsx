/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { Card, makeStyles, Typography } from '@material-ui/core';
import cardItemStyle from './cardItem.style';

interface CardProps extends React.AllHTMLAttributes<HTMLDivElement> {
    yamlDoc: any;
}

const makeCardStyle = makeStyles(cardItemStyle);

export const CardItem: React.FC<CardProps> = ({
    yamlDoc
}: CardProps) => {

    const style = makeCardStyle();

    return (
        <>
            <Card
                className={style.card}
                data-testid={`card-${yamlDoc.metadata.name.replace(/\.| /g, '')}`}
            >
                <div className={style.cardHeader}>
                    <div className={style.cardHeaderDisplay}>
                        <img
                            src={yamlDoc.metadata.icon}
                            className={style.cardImage} />
                    </div>
                </div>
                <div style={{ margin: '1.5rem' }}>
                    <Typography variant='body1'>{yamlDoc.metadata.name}</Typography>
                </div>
                <div className={style.cardBody}>
                    {
                        yamlDoc.metadata.version && (
                            <Typography variant='caption'>
                                Version: {yamlDoc.metadata.version}<br />
                            </Typography>
                        )
                    }
                    <Typography variant='caption'>
                        Project Type: {yamlDoc.metadata.projectType}<br />
                    </Typography>
                    <Typography variant='caption'>
                        Language: {yamlDoc.metadata.language}<br />
                    </Typography>
                </div>
            </Card>
        </>
    );
}
