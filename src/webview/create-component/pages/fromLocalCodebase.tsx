import { Button, CircularProgress, Divider, FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material';
import * as React from 'react';
import { Uri } from 'vscode';
import { ComponentNameInput } from '../../common/componentNameInput';
import { Devfile } from '../../common/devfile';
import { DevfileListItem } from '../../common/devfileListItem';
import { DevfileRecommendationInfo } from '../../common/devfileRecommendationInfo';

type Message = {
    action: string;
    data: any;
}

export type ComponentNameState = {
    name: string
    isValid: boolean;
    helpText: string;
}

type RecommendedDevfileState = {
    devfile: Devfile
    showRecommendation: boolean;
    isLoading: boolean;
    isDevfileExistsInFolder: boolean;
}

export function FromLocalCodebase({ setCurrentView }) {
    const [workspaceFolders, setWorkspaceFolders] = React.useState<Uri[]>([]);
    const [projectFolder, setProjectFolder] = React.useState('');
    const [componentName, setComponentName] = React.useState('');
    const [isComponentNameFieldValid, setComponentNameFieldValid] = React.useState(true);
    const [componentNameErrorMessage, setComponentNameErrorMessage] = React.useState('Please enter a component name.');

    const [recommendedDevfile, setRecommendedDevfile] = React.useState<RecommendedDevfileState>({
        devfile: undefined,
        showRecommendation: false,
        isLoading: false,
        isDevfileExistsInFolder: false
    });

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'workspaceFolders': {
                setWorkspaceFolders(_workspaceFolders => message.data);
                break;
            }
            case 'recommendedDevfile': {
                setRecommendedDevfile((prevState) => ({ ...prevState, devfile: message.data.devfile }));
                setRecommendedDevfile((prevState) => ({ ...prevState, showRecommendation: true }));
                setRecommendedDevfile((prevState) => ({ ...prevState, isLoading: false }));
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
            case 'selectedProjectFolder': {
                setProjectFolder(message.data);
                break;
            }
            case 'devfileExists': {
                setRecommendedDevfile((prevState) => ({ ...prevState, isDevfileExistsInFolder: message.data }));
                break;
            }
        }
    }

    React.useEffect(() => {
        window.addEventListener('message', respondToMessage);
        return () => {
            window.removeEventListener('message', respondToMessage);
        };
    }, []);

    function handleNext() {
        window.vscodeApi.postMessage({
            action: 'getRecommendedDevfile',
            data: projectFolder
        });
        setRecommendedDevfile((prevState) => ({ ...prevState, isLoading: true }));
    };

    function handleCreateComponent() {
        window.vscodeApi.postMessage({
            action: 'createComponent',
            data: {
                devfileDisplayName: recommendedDevfile.devfile.name,
                componentName: componentName,
                path: projectFolder
            }
        });
    };

    return (
        <>
            <div style={{ position: 'relative', marginTop: '5em' }}>
                <Typography variant='h5'>
                    From Existing Local Codebase
                </Typography>
            </div>
            <Stack direction='column' spacing={2} marginTop={4}>
                <ComponentNameInput
                    isComponentNameFieldValid={isComponentNameFieldValid}
                    componentNameErrorMessage={componentNameErrorMessage}
                    setComponentName={setComponentName}
                />
                <Stack direction='row' spacing={1} marginTop={1}>
                    <FormControl fullWidth error={recommendedDevfile.isDevfileExistsInFolder} >
                        <InputLabel id="project-path-label">Folder</InputLabel>
                        <Select fullWidth
                            className='selectFolder'
                            labelId="project-path-label"
                            value={projectFolder}
                            label="Folder"
                            onChange={(e) => { setProjectFolder(e.target.value as string) }}
                            disabled={recommendedDevfile.showRecommendation || workspaceFolders.length === 0} >
                            {workspaceFolders.length !== 0 && workspaceFolders.map((uri) => (
                                <MenuItem key={uri.path} value={uri.path}>
                                    {uri.path}
                                </MenuItem>
                            ))}
                        </Select>
                        {recommendedDevfile.isDevfileExistsInFolder &&
                            <FormHelperText>A devfile already exists in this project, please select another folder.</FormHelperText>}
                        {workspaceFolders.length === 0 &&
                            <FormHelperText>There are no projects in the workspace, select folder or open a folder in the workspace.</FormHelperText>}
                    </FormControl>
                    {!recommendedDevfile.showRecommendation &&
                        <Button
                            variant="outlined"
                            sx={{ whiteSpace: 'nowrap', height: '4em'}}
                            onClick={(e) => {
                                window['vscodeApi'].postMessage({
                                    action: 'selectProjectFolder',
                                });
                            }}
                        >
                            Select Folder
                        </Button>
                    }
                </Stack>
                {!recommendedDevfile.showRecommendation ? (
                    <>
                        <Stack direction='row' spacing={1} marginTop={2}>
                            <Button variant='text' onClick={() => { setCurrentView('home') }}>
                                BACK
                            </Button>
                            <Button variant='contained' disabled={!isComponentNameFieldValid || projectFolder.length === 0 || recommendedDevfile.isDevfileExistsInFolder} onClick={handleNext}>
                                NEXT
                            </Button>
                        </Stack>
                        {recommendedDevfile.isLoading &&
                            <Stack direction='column' spacing={3} alignItems='center'>
                                <Divider variant="middle" sx={{ marginTop: '2em' }} />
                                <CircularProgress />
                                <Typography variant='body2'>
                                    Scanning for recommended devfile.
                                </Typography>
                            </Stack>
                        }
                    </>
                ) : (
                    <>
                        <Divider variant="middle" sx={{ marginTop: '2em' }} />
                        <Stack direction='column'>
                            <Stack direction='row' justifyContent='space-between' marginTop={1}>
                                <Typography variant='h6'>
                                    Recommended Devfile
                                </Typography>
                                <DevfileRecommendationInfo />
                            </Stack>
                            <DevfileListItem devfile={recommendedDevfile.devfile} />
                            <Stack direction='row' justifyContent='flex-end' spacing={1} marginTop={2}>
                                <Button variant='text' onClick={() => { setRecommendedDevfile((prevState) => ({ ...prevState, showRecommendation: false })) }} sx={{ marginRight: 'auto' }}>
                                    BACK
                                </Button>
                                <Button variant='text' onClick={() => { setCurrentView('devfileSearch') }}>
                                    SELECT A DIFFERENT DEVFILE
                                </Button>
                                <Button variant='contained' onClick={handleCreateComponent}>
                                    CREATE COMPONENT
                                </Button>
                            </Stack >
                        </Stack >
                    </>
                )}
            </Stack>
        </>
    );
}
