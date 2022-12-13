/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import React from 'react';
import { makeStyles } from '@mui/styles';
import CheckBoxOutlineBlankOutlinedIcon from '@mui/icons-material/CheckBoxOutlineBlankOutlined';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import { Badge, Card, Typography } from '@material-ui/core';
import { CompTypeDesc } from './gitImport';
import cardItemStyle from './cardItem.style';

const makeCardStyle = makeStyles(cardItemStyle);

interface CardProps extends React.AllHTMLAttributes<HTMLDivElement> {
    compDesc: CompTypeDesc;
    onCardClick: (selectedComp: CompTypeDesc) => void;
}

export const CardItem: React.FC<CardProps> = ({
    compDesc,
    onCardClick
}: CardProps) => {

    const style = makeCardStyle();

    return (
        <>
            <Card
                className={style.card}
                onClick={() => onCardClick(compDesc)}
                data-testid={`card-${compDesc.devfileData.devfile.metadata.name.replace(/\.| /g, '')}`}
            >
                <div className={style.cardHeader}>
                    <div className={style.cardHeaderDisplay}>
                        <img
                            src={compDesc.devfileData.devfile.metadata.icon}
                            className={style.cardImage} />
                        <div className={style.cardRegistryTitle}>
                            {compDesc.selected ? <CheckBoxOutlinedIcon style={{ fontSize: 20, color: '#EE0000' }} /> : <CheckBoxOutlineBlankOutlinedIcon style={{ fontSize: 20, color: '#EE0000' }} />}
                        </div>
                    </div>
                </div>
                <div style={{ margin: '1.5rem' }}>
                    <Typography variant='body1'>{compDesc.devfileData.devfile.metadata.name}</Typography>
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem', width: 'auto' }}>
                    <div className={style.cardBody}>
                        {
                            compDesc.devfileData.devfile.metadata.version && (
                                <Typography variant='caption'>
                                    Version: {compDesc.devfileData.devfile.metadata.version}<br />
                                </Typography>
                            )
                        }
                        <Typography variant='caption'>
                            Project Type: {capitalizeFirstLetter(compDesc.devfileData.devfile.metadata.projectType)}<br />
                        </Typography>
                        <Typography variant='caption'>
                            Language: {capitalizeFirstLetter(compDesc.devfileData.devfile.metadata.language)}<br />
                        </Typography>
                    </div>
                    {
                        compDesc.registry.name.toLowerCase() !== 'defaultdevfileregistry' &&
                        <div style={{alignSelf:'flex-end', marginBottom: '2rem'}}>
                            <Badge key='badge' className={style.badge}
                                overlap='rectangular'
                                variant='standard'>
                                {compDesc.registry.name}
                            </Badge>
                        </div>
                    }
                </div>
            </Card>
        </>
    );
}

function capitalizeFirstLetter(value?: string): string {
    return value[0].toUpperCase() + value.substring(1);
}
