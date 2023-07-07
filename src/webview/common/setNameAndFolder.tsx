/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import {
    Alert,
    Button,
    Container,
    FormControl,
    FormHelperText,
    Paper,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import * as React from 'react';
import 'react-dom';
import { Devfile } from './devfile';
import { DevfileListItem } from './devfileListItem';

type Message = {
    action: string;
    data: any;
};

type SetNameAndFolderProps = {
    goBack: () => void,
    createComponent: (projectFolder: string, componentName: string) => void,
    devfile: Devfile,
    templateProject: string,
};

export function SetNameAndFolder(props: SetNameAndFolderProps) {
    const [componentName, setComponentName] = React.useState('');
    const [isComponentNameFieldInteracted, setComponentNameFieldInteracted] = React.useState(false);

    const [componentParentFolder, setComponentParentFolder] = React.useState('');
    const [isFolderFieldValid, setFolderFieldValid] = React.useState('');
    const [folderFieldErrorMessage, setFolderFieldErrorMessage] = React.useState('');
    const [isFolderFieldInteracted, setFolderFieldInteracted] = React.useState(false);

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'isValidProjectFolder': {
                setFolderFieldValid((_) => message.data.valid);
                setFolderFieldErrorMessage((_) => message.data.message);
                break;
            }
            case 'selectedProjectFolder': {
                setComponentParentFolder(message.data);
                break;
            }
        }
    }

    React.useEffect(() => {
        window['vscodeApi'].postMessage({
            action: 'isValidProjectFolder',
            data: {
                folder: componentParentFolder,
                componentName,
            },
        });
    }, [componentParentFolder, componentName]);

    React.useEffect(() => {
        window.addEventListener('message', respondToMessage);
        return () => {
            window.removeEventListener('message', respondToMessage);
        };
    }, []);

    return (
        <Container sx={{ paddingY: '16px' }}>
            <Stack direction="column" spacing={3}>
                <Typography variant="h5" alignSelf="center">
                    Set Component Name and Folder
                </Typography>

                <Stack direction="column" spacing={3}>
                    <Paper elevation={4}>
                        <Stack margin={2} spacing={2}>
                            <DevfileListItem devfile={props.devfile} />
                            {/* padding here is to match the padding build into the devfile list component */}
                            <Stack direction='row' alignItems='center' spacing={1} paddingX={1}>
                                <Typography variant="body1">Project:</Typography>
                                <code>{props.templateProject}</code>
                            </Stack>
                        </Stack>
                    </Paper>
                    <FormControl>
                        <TextField
                            fullWidth
                            variant="outlined"
                            label="Component Name"
                            onChange={(e) => {
                                setComponentName((_) => e.target.value);
                            }}
                            error={
                                isComponentNameFieldInteracted &&
                                !isComponentNameValid(componentName)
                            }
                            onClick={(e) => {
                                setComponentNameFieldInteracted((_) => true);
                            }}
                            value={componentName}
                        />
                        <FormHelperText>
                            Can only contain letters, numbers, and dashes (<code>-</code>).
                        </FormHelperText>
                    </FormControl>
                    <FormControl fullWidth>
                        <Stack direction="row" spacing={2}>
                            <TextField
                                fullWidth
                                variant="outlined"
                                label="Project Folder Path"
                                onChange={(e) => {
                                    setComponentParentFolder((_) => e.target.value);
                                }}
                                onClick={(e) => {
                                    setFolderFieldInteracted((_) => true);
                                }}
                                error={isFolderFieldInteracted && !isFolderFieldValid}
                                value={componentParentFolder}
                            />
                            <Button
                                variant="outlined"
                                sx={{ whiteSpace: 'nowrap' }}
                                onClick={(e) => {
                                    window['vscodeApi'].postMessage({
                                        action: 'selectProjectFolderNewProject',
                                    });
                                }}
                            >
                                Select Folder
                            </Button>
                        </Stack>
                        {componentParentFolder && isComponentNameValid(componentName) && (
                            <FormHelperText>{folderFieldErrorMessage}</FormHelperText>
                        )}
                    </FormControl>

                    <Stack direction="row" justifyContent="space-between">
                        <Button variant="text" onClick={props.goBack}>
                            Use Different Template Project
                        </Button>
                        {!isComponentNameValid(componentName) || !isFolderFieldValid ? (
                            <Alert severity="error">
                                Please set a valid{' '}
                                {!isComponentNameValid(componentName) && ' component name '}
                                {!isComponentNameValid(componentName) &&
                                    !isFolderFieldValid &&
                                    ' and '}
                                {!isFolderFieldValid && 'folder'}.
                            </Alert>
                        ) : (
                            <Button
                                variant="contained"
                                onClick={() => {
                                    props.createComponent(componentParentFolder, componentName);
                                }}
                            >
                                Create Component
                            </Button>
                        )}
                    </Stack>
                </Stack>
            </Stack>
        </Container>
    );
}

function isComponentNameValid(name: string) {
    return /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name);
}
