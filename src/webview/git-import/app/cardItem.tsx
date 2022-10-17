/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { Card, makeStyles, Typography } from '@material-ui/core';
import { ComponentTypeDescription } from '../../../odo/componentType';
import cardItemStyle from './cardItem.style';

const makeCardStyle = makeStyles(cardItemStyle);

interface CardProps extends React.AllHTMLAttributes<HTMLDivElement> {
    compDesc: ComponentTypeDescription;
}

export const CardItem: React.FC<CardProps> = ({
    compDesc
}: CardProps) => {

    const style = makeCardStyle();

    return (
        <>
            <Card
                className={style.card}
                data-testid={`card-${compDesc.Devfile.metadata.name.replace(/\.| /g, '')}`}
            >
                <div className={style.cardHeader}>
                    <div className={style.cardHeaderDisplay}>
                        <img
                            src={compDesc.Devfile.metadata.icon}
                            className={style.cardImage} />
                    </div>
                </div>
                <div style={{ margin: '1.5rem' }}>
                    <Typography variant='body1'>{compDesc.Devfile.metadata.name}</Typography>
                </div>
                <div className={style.cardBody}>
                    {
                        compDesc.Devfile.metadata.version && (
                            <Typography variant='caption'>
                                Version: {compDesc.Devfile.metadata.version}<br />
                            </Typography>
                        )
                    }
                    <Typography variant='caption'>
                        Project Type: {capitalizeFirstLetter(compDesc.Devfile.metadata.projectType)}<br />
                    </Typography>
                    <Typography variant='caption'>
                        Language: {capitalizeFirstLetter(compDesc.Devfile.metadata.language)}<br />
                    </Typography>
                </div>
            </Card>
        </>
    );
}

function capitalizeFirstLetter(value?: string): string {
    return value[0].toUpperCase() + value.substring(1);
}
