/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import * as React from 'react';


interface OptionCardProps {
    title: string;
    description: string;
    icon: any;
}

export default function OptionCard(props: OptionCardProps) {

    function handleCreateClick() {
        // do nothing for now
    };

    return (
        <Card variant="outlined">
            <div style={{ display: 'flex', height: '10em', alignItems: 'center', gap: '2em', marginTop: '1em'}}>
                <props.icon sx={{ width: '30px', height: '30px', marginLeft: '1.5em', color: 'var(--vscode-editor-foreground)'}}/>
                <Typography variant='h6'>
                    {props.title}
                </Typography>
            </div>
            <CardContent sx={{ height: '15em' }}>
                <Typography variant='body1' margin='1em'>
                    {props.description}
                </Typography>
            </CardContent>
            <CardActions sx={{ justifyContent: 'center', height: '5em' }}>
                <Button variant='text' onClick={handleCreateClick} size='large' sx={{ marginBottom: '1em' }}>
                    CREATE
                </Button>
            </CardActions>
        </Card>
    );
}
