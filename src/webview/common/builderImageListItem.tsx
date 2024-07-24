/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Box, Stack, SvgIcon, Typography } from '@mui/material';
import * as React from 'react';
import { BuilderImage } from './buildImage';
import { getIcons as getLogo } from './builderImageLogo';

export type BuilderImageListItemProps = {
    builderImage: BuilderImage;
    buttonCallback?: () => void;
    showFullDescription?: boolean;
};

export function BuilderImageListItem(props: BuilderImageListItemProps) {
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
                    <BuilderImageListContent
                        builderImage={props.builderImage}
                        buttonCallback={props.buttonCallback}
                        showFullDescription={props.showFullDescription}
                    />
                </Box>
            ) : (
                <>
                    <BuilderImageListContent builderImage={props.builderImage} showFullDescription={props.showFullDescription} />
                </>
            )}
        </>
    );
}

function BuilderImageListContent(props: BuilderImageListItemProps) {
    // for the width setting:
    // one unit of padding is 8px with the default MUI theme, and we add a margin on both sides
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
                <SvgIcon component={getLogo(props.builderImage.iconClass)} style={{
                    maxWidth: !props.showFullDescription ? '3em' : '6em',
                    maxHeight: !props.showFullDescription ? '3em' : '6em'
                }} inheritViewBox/>

            </Box>
            <Stack
                direction="column"
                spacing={1}
                maxWidth={!props.showFullDescription ? '90%' : '50rem'}
                minWidth={0}
                sx={{ flexShrink: '10' }}
            >
                <Stack direction="row" spacing={2} alignItems="center">
                    <Typography
                        id="devfileName"
                        variant="body1"
                        maxWidth={'30%'}
                        sx={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        {props.builderImage.displayName}
                    </Typography>

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
                        {props.builderImage.description}
                    </Typography>
                </Stack>
            </Stack>
        </Stack>
    );
}
