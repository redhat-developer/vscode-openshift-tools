/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import {
    Alert,
    Box,
    Button,
    Checkbox,
    FormControl,
    FormControlLabel,
    FormHelperText,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import * as React from 'react';
import 'react-dom';
import { ComponentNameInput } from './componentNameInput';
import { CreateComponentButton, CreateComponentErrorAlert } from './createComponentButton';
import { Devfile } from './devfile';
import { DevfileListItem } from './devfileListItem';

type Message = {
    action: string;
    data: any;
};

type SetNameAndFolderProps = {
    goBack: () => void;
    createComponent: (projectFolder: string, componentName: string, addToWorkspace: boolean) => void;
    devfile: Devfile;
    templateProject?: string;
    initialComponentName?: string;
};

export function SetNameAndFolder(props: SetNameAndFolderProps) {
    const [componentName, setComponentName] = React.useState(props.initialComponentName);
    const [isComponentNameFieldValid, setComponentNameFieldValid] = React.useState(true);
    const [componentNameErrorMessage, setComponentNameErrorMessage] = React.useState(
        'Please enter a component name.',
    );

    const [componentParentFolder, setComponentParentFolder] = React.useState('');
    const [isFolderFieldValid, setFolderFieldValid] = React.useState(false);
    const [folderFieldErrorMessage, setFolderFieldErrorMessage] = React.useState('');
    const [isFolderFieldInteracted, setFolderFieldInteracted] = React.useState(false);

    const [isAddToWorkspace, setAddToWorkspace] = React.useState(true);

    const [isLoading, setLoading] = React.useState(false);

    const [createComponentErrorMessage, setCreateComponentErrorMessage] = React.useState('');

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
            case 'validatedComponentName': {
                if (message.data) {
                    setComponentNameFieldValid(false);
                    setComponentNameErrorMessage(message.data);
                } else {
                    setComponentNameFieldValid(true);
                    setComponentNameErrorMessage('');
                }
                break;
            }
            case 'createComponentFailed': {
                setLoading(false);
                setCreateComponentErrorMessage(message.data);
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

    React.useEffect(() => {
        if (props.initialComponentName) {
            window.vscodeApi.postMessage({
                action: 'validateComponentName',
                data: props.initialComponentName,
            });
        }
    }, []);

    return (
        <Stack direction="column" spacing={3}>
            <div style={{ position: 'relative' }}>
                <Typography variant="h5">Set Component Name and Folder</Typography>
            </div>

            <Stack direction="column" spacing={2} marginTop={2}>
                {props.devfile ? (
                    <Paper elevation={4}>
                        <Stack margin={2} spacing={2}>
                            <DevfileListItem devfile={props.devfile} />
                            {/* padding here is to match the padding build into the devfile list component */}
                            {props.templateProject && (
                                <Stack direction="row" alignItems="center" spacing={1} paddingX={1}>
                                    <Typography variant="body1">Project:</Typography>
                                    <code>{props.templateProject}</code>
                                </Stack>
                            )}
                        </Stack>
                    </Paper>
                ) : (
                    <Alert severity="info">The Devfile that exists in the repo will be used</Alert>
                )}
                <ComponentNameInput
                    isComponentNameFieldValid={isComponentNameFieldValid}
                    componentNameErrorMessage={componentNameErrorMessage}
                    componentName={componentName}
                    setComponentName={setComponentName}
                />
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
                            variant="contained"
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
                    {!isComponentNameFieldValid && (
                        <FormHelperText>
                            The project will be created in a new subfolder under this folder
                        </FormHelperText>
                    )}
                    {componentParentFolder && isComponentNameFieldValid && (
                        <FormHelperText>{folderFieldErrorMessage}</FormHelperText>
                    )}
                </FormControl>

                <FormControlLabel
                    control={
                        <Checkbox
                            checked={isAddToWorkspace}
                            onClick={(_) => {
                                setAddToWorkspace((oldAddToWorkspace) => !oldAddToWorkspace);
                            }}
                        />
                    }
                    label="Add component to workspace"
                />

                <Stack direction="row" justifyContent="space-between">
                    <Button variant="text" onClick={props.goBack}>
                        {props.templateProject ? 'Use Different Template Project' : 'Back'}
                    </Button>
                    <CreateComponentButton
                        componentName={componentName}
                        componentParentFolder={componentParentFolder}
                        addToWorkspace={isAddToWorkspace}
                        isComponentNameFieldValid={isComponentNameFieldValid}
                        isFolderFieldValid={isFolderFieldValid}
                        isLoading={isLoading}
                        createComponent={props.createComponent}
                        setLoading={setLoading}
                    />
                </Stack>
                <CreateComponentErrorAlert
                    createComponentErrorMessage={createComponentErrorMessage}
                />
            </Stack>
        </Stack>
    );
}
