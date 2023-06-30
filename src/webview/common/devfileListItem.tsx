import { Check, Close } from '@mui/icons-material';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import * as React from 'react';

export type Devfile = {
    name: string;
    description: string;
    logoUrl: string;
    supportsDebug: boolean;
    supportsDeploy: boolean;
    tags: string[];
    sampleProjects: string[];
    yaml: string;
}

export type DevfileListItemProps = {
    devfile: Devfile;
    buttonCallback?: () => void;
};

export function DevfileListItem(props: DevfileListItemProps) {
    // for the width setting:
    // one unit of padding is 8px with the default MUI theme, and we add a margin on both sides
    return (
        <Stack
            direction="row"
            sx={{ width: 'calc(100% - 16px)' }}
            alignItems="center"
            paddingX={1}
            spacing={3}
        >
            <img src={props.devfile.logoUrl} style={{ maxWidth: '6em', maxHeight: '6em' }} />
            <Stack
                direction="column"
                spacing={1}
                sx={{ flexShrink: '5', minWidth: '0', maxWidth: '35rem' }}
            >
                <Typography
                    variant="body1"
                    sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                    {props.devfile.name}
                </Typography>
                <Typography
                    variant="body2"
                    sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                    {props.devfile.description}
                </Typography>
                <Stack direction="row" spacing={1}>
                    <Chip
                        size="small"
                        label="Debug Support"
                        icon={props.devfile.supportsDebug ? <Check /> : <Close />}
                        color={props.devfile.supportsDebug ? 'success' : 'error'}
                    />
                    <Chip
                        size="small"
                        label="Deploy Support"
                        icon={props.devfile.supportsDeploy ? <Check /> : <Close />}
                        color={props.devfile.supportsDeploy ? 'success' : 'error'}
                    />
                    {props.devfile.tags.map((tag) => {
                        return <Chip size="small" label={tag} key={tag} />;
                    })}
                </Stack>
            </Stack>
            <Box sx={{ flexGrow: '1' }} />
            {props.buttonCallback ? (
                <Button variant="outlined" onClick={props.buttonCallback}>
                    Use Devfile
                </Button>
            ) : (
                <></>
            )}
        </Stack>
    );
}
