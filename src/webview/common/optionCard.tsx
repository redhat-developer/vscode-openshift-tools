/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import * as React from 'react';


interface OptionCardProps {
    pageId: string;
    description: string;
    setCurrentView: any;
    title: string;
    icon: any;
}

export default function OptionCard(props: OptionCardProps) {

    return (
        <Card variant='outlined'>
            <div style={{ display: 'flex', height: '10em', alignItems: 'center', gap: '2em', marginTop: '1em' }}>
                <props.icon sx={{ width: '30px', height: '30px', marginLeft: '1.5em', color: 'var(--vscode-editor-foreground)' }} />
                <Typography variant='h6' sx={{ marginRight: '1.5em' }}>
                    {props.title}
                </Typography>
            </div>
            <CardContent style={{ marginLeft: '1em', marginRight: '1em' }}>
                <Typography variant='body2'>
                    {props.description}
                </Typography>
            </CardContent>
            <CardActions sx={{ justifyContent: 'center', height: '5em' }}>
                <Button variant='text' onClick={() => { props.setCurrentView(props.pageId) }} size='large' sx={{ marginBottom: '1em' }}>
                    CREATE
                </Button>
            </CardActions>
        </Card>
    );
}
