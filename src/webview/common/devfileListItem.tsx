/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Check, Close } from '@mui/icons-material';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import * as React from 'react';
import { Devfile } from '../common/devfile';

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
            justifyContent="space-between"
        >
            <Stack direction="row" spacing={3}>
                <Box
                    sx={{
                        display: 'flex',
                        width: '7em',
                        height: '7em',
                        bgcolor: 'white',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                    }}
                >
                    <img
                        src={props.devfile.logoUrl}
                        style={{ maxWidth: '6em', maxHeight: '6em' }}
                    />
                </Box>
                <Stack
                    direction="column"
                    spacing={1}
                    sx={{ flexShrink: '5', minWidth: '0', maxWidth: '35rem' }}
                >
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Typography
                            variant="body1"
                            sx={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {props.devfile.name}
                        </Typography>
                        <Typography variant="body2" fontStyle="italic">
                            from {props.devfile.registryName}
                        </Typography>
                    </Stack>
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
                        {props.devfile.tags.map((tag, i) => {
                            if (i >= 4) {
                                return;
                            }
                            return <Chip size="small" label={tag} key={tag} />;
                        })}
                        {props.devfile.tags.length > 4 && (
                            <Chip size="small" label="..." key="ellipsis" />
                        )}
                    </Stack>
                </Stack>
            </Stack>
            {props.buttonCallback ? (
                <Button variant="contained" onClick={props.buttonCallback}>
                    Use Devfile
                </Button>
            ) : (
                <></>
            )}
        </Stack>
    );
}
