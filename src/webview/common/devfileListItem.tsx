/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Check } from '@mui/icons-material';
import { Box, Chip, Link, Stack, Tooltip, Typography } from '@mui/material';
import * as React from 'react';
import { Devfile } from '../common/devfile';
import DevfileLogo from '../../../images/context/devfile.png';
import validator from 'validator'

export type DevfileListItemProps = {
    devfile: Devfile;
    buttonCallback?: () => void;
    showFullDescription?: boolean;
};

function checkedDevfileLogoUrl(logoUrl?: string) {
    if (logoUrl && validator.isURL(logoUrl)) {
        return logoUrl;
    }
    return DevfileLogo;
}

export function DevfileListItem(props: DevfileListItemProps) {
    return (
        <>
            {props.buttonCallback ? (
                <Box
                    onClick={props.buttonCallback}
                    sx={{
                        padding: '1em',
                        '&:hover': {
                            backgroundColor: 'var(--vscode-editor-hoverHighlightBackground)',
                            cursor: 'pointer',
                        },
                    }}
                >
                    <DevfileListContent
                        devfile={props.devfile}
                        buttonCallback={props.buttonCallback}
                        showFullDescription={props.showFullDescription}
                    />
                </Box>
            ) : (
                <>
                    <DevfileListContent devfile={props.devfile} showFullDescription={props.showFullDescription} />
                </>
            )}
        </>
    );
}

function DevfileListContent(props: DevfileListItemProps) {
    const [showMore, setShowMore] = React.useState(false);
    // for the width setting:
    // one unit of padding is 8px with the default MUI theme, and we add a margin on both sides
    return (
        <Stack direction="row" spacing={3} sx={{ width: 'calc(100% - 16px)' }} alignItems="center">
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
                <img src={checkedDevfileLogoUrl(props.devfile.logoUrl)} style={{ maxWidth: '6em', maxHeight: '6em' }} />
            </Box>
            <Stack
                direction="column"
                spacing={1}
                sx={{ flexShrink: '5', minWidth: '0', maxWidth: !props.showFullDescription ? '35rem' : '45rem' }}
            >
                <Stack direction="row" spacing={2} alignItems="center">
                    <Typography
                        id="devfileName"
                        variant="body1"
                        sx={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {props.devfile.name}
                    </Typography>

                    {props.devfile.registryName && (
                        <Typography variant="body2" fontStyle="italic">
                            from {props.devfile.registryName}
                        </Typography>
                    )}
                </Stack>
                <Stack direction="row" spacing={1}>
                    <Typography
                        variant="body2"
                        sx={{
                            whiteSpace: !showMore ? 'nowrap' : 'pre-wrap',
                            overflow: !showMore ? 'hidden' : 'visible',
                            textOverflow: !showMore ? 'ellipsis' : 'unset',
                            textAlign: 'justify'
                        }}
                    >
                        {props.devfile.description}
                    </Typography>
                    {
                        props.showFullDescription && props.devfile.description.length > 102 && <Link
                            component="button"
                            variant="body2"
                            underline='none'
                            onClick={() => {
                                setShowMore((prev) => !prev);
                            }}
                        >
                            {!showMore ? 'More' : 'Less'}
                        </Link>
                    }
                </Stack>
                <Stack direction="row" spacing={1}>
                    {
                        props.devfile.supportsDebug && <Chip
                            size="small"
                            label="Debug Support"
                            icon={<Check />}
                            color={'success'}
                        />
                    }
                    {
                        props.devfile.supportsDeploy && <Chip
                            size="small"
                            label="Deploy Support"
                            icon={<Check />}
                            color={'success'}
                        />
                    }
                    {(props.devfile.tags && props.devfile.tags.map((tag, i) => {
                        if (i >= 4) {
                            return;
                        }
                        return <Chip size="small" label={tag} key={tag} />;
                    }))}
                    {(props.devfile.tags && props.devfile.tags.length > 4 && (
                        <Tooltip title={props.devfile.tags.slice(4).join(', ')}>
                            <Chip size="small" label="• • •" />
                        </Tooltip>
                    ))}
                </Stack>
            </Stack>
        </Stack>
    );
}
