/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Check } from '@mui/icons-material';
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import * as React from 'react';
import validator from 'validator';
import DOMPurify from 'dompurify';
import DevfileLogo from '../../../images/context/devfile.png';
import { DevfileData, DevfileInfo } from '../../devfile-registry/devfileInfo';

export type DevfileListItemProps = {
    devfileInfo?: DevfileInfo;
    devfile: DevfileData;
    buttonCallback?: () => void;
    showFullDescription?: boolean;
};

function checkedDevfileLogoUrl(logoUrl?: string) {
    if (logoUrl && validator.isURL(logoUrl)) {
        return DOMPurify.sanitize(logoUrl);
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
                        devfileInfo={props.devfileInfo}
                        devfile={props.devfile}
                        buttonCallback={props.buttonCallback}
                        showFullDescription={props.showFullDescription}
                    />
                </Box>
            ) : (
                <>
                    <DevfileListContent
                        devfileInfo={props.devfileInfo}
                        devfile={props.devfile}
                        showFullDescription={props.showFullDescription}
                    />
                </>
            )}
        </>
    );
}

function DevfileListContent(props: DevfileListItemProps) {
    // for the width setting:
    // one unit of padding is 8px with the default MUI theme, and we add a margin on both sides

    const icon = checkedDevfileLogoUrl(props.devfile?.metadata?.icon ?
            props.devfile.metadata.icon : props.devfileInfo?.icon);
    const name =  props.devfile?.metadata?.displayName ? props.devfile.metadata.displayName : props.devfileInfo?.displayName;
    const version = props.devfile?.metadata?.version ? props.devfile.metadata.version : undefined;
    const registryName = props.devfileInfo?.registry?.name;
    const isDebugSupported = props.devfileInfo?.versions?.some((version) => version.commandGroups.debug === true);
    const isDeploySupported = props.devfileInfo?.versions?.some((version) => version.commandGroups.deploy === true);
    const tags = props.devfileInfo?.tags;
    const description = props.devfile?.metadata?.description ?
            props.devfile.metadata.description : props.devfileInfo?.description;
    return (
        <Stack direction="row" spacing={3} alignItems="center">
            <Box
                sx={{
                    display: 'flex',
                    width: !props.showFullDescription ? '4em' : '7em',
                    height: !props.showFullDescription ? '4em' : '7em',
                    bgcolor: 'white',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                }}
            >
                <img src={icon} style={{
                    maxWidth: !props.showFullDescription ? '3em' : '6em',
                    maxHeight: !props.showFullDescription ? '3em' : '6em'
                }} />
            </Box>
            <Stack
                direction="column"
                spacing={1}
                maxWidth={ !props.showFullDescription ? '90%': '50rem'}
                minWidth={0}
                sx={{ flexShrink: '10' }}
            >
                <Stack direction="row" spacing={2} alignItems="center">
                    <Typography
                        id="devfileName"
                        variant="body1"
                        maxWidth={'40%'}
                        sx={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        {name}{ version && `, v. ${version}`}
                    </Typography>

                    {
                        registryName && (
                            <Typography variant="body2" fontStyle="italic" maxWidth={'50%'}>
                                from {registryName}
                            </Typography>
                    )}

                    <Stack direction="row" spacing={1} maxWidth={'30%'}>
                        {
                            isDebugSupported &&
                                <Chip
                                    size="small"
                                    label="Debug Support"
                                    icon={<Check />}
                                    color={'success'}
                                />
                        }
                        {
                            isDeploySupported &&
                                <Chip
                                    size="small"
                                    label="Deploy Support"
                                    icon={<Check />}
                                    color={'success'}
                                />
                        }
                        {(tags && tags.map((tag, i) => {
                            if (i >= 4) {
                                return;
                            }
                            return <Chip size="small" label={tag} key={tag} />;
                        }))}
                        {(tags && tags.length > 4 && (
                            <Tooltip title={tags.slice(4).join(', ')}>
                                <Chip size="small" label="• • •" />
                            </Tooltip>
                        ))}
                    </Stack>
                </Stack>
                <Stack direction="row" spacing={1}>
                    <Typography
                        variant="body2"
                        sx={{
                            whiteSpace: !props.showFullDescription ? 'nowrap' : 'pre-wrap',
                            overflow: !props.showFullDescription ? 'hidden' : 'visible',
                            textOverflow: !props.showFullDescription ? 'ellipsis' : 'unset',
                            textAlign: 'justify',
                            maxHeight: !props.showFullDescription ? '4rem' : 'unset'
                        }}
                    >
                        {description}
                    </Typography>
                </Stack>
            </Stack>
        </Stack>
    );
}
