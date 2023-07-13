import LoadingButton from '@mui/lab/LoadingButton';
import { Button, CircularProgress, Divider, FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material';
import * as React from 'react';
import { Uri } from 'vscode';
import { ComponentNameInput } from '../../common/componentNameInput';
import { Devfile } from '../../common/devfile';
import { DevfileListItem } from '../../common/devfileListItem';
import { DevfileRecommendationInfo } from '../../common/devfileRecommendationInfo';
import { DevfileSearch } from '../../common/devfileSearch';

type Message = {
    action: string;
    data: any;
}

type CurrentPage = 'fromLocalCodeBase' | 'selectDifferentDevfile';

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
    const [currentPage, setCurrentPage] = React.useState<CurrentPage>('fromLocalCodeBase');
    const [workspaceFolders, setWorkspaceFolders] = React.useState<Uri[]>([]);
    const [projectFolder, setProjectFolder] = React.useState('');
    const [componentName, setComponentName] = React.useState('');
    const [isComponentNameFieldValid, setComponentNameFieldValid] = React.useState(true);
    const [componentNameErrorMessage, setComponentNameErrorMessage] = React.useState('Please enter a component name.');
    const [isLoading, setLoading] = React.useState(false);

    const [recommendedDevfile, setRecommendedDevfile] = React.useState<RecommendedDevfileState>({
        devfile: undefined,
        showRecommendation: false,
        isLoading: false,
        isDevfileExistsInFolder: false
    });

    const [selectedDevfile, setSelectedDevfile] = React.useState<Devfile>();

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

    React.useEffect(() => {
        window.vscodeApi.postMessage({ action: 'getWorkspaceFolders' });
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
                devfileDisplayName: selectedDevfile ? (selectedDevfile.name) : (recommendedDevfile.devfile.name),
                componentName: componentName,
                path: projectFolder
            }
        });
        setLoading(true);
    };

    switch (currentPage) {
        case 'fromLocalCodeBase':
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
                            componentName={componentName}
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
                                    sx={{ whiteSpace: 'nowrap', height: '4em' }}
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
                                    <Button
                                        variant='contained'
                                        disabled={!isComponentNameFieldValid || componentName.length === 0 || projectFolder.length === 0 || recommendedDevfile.isDevfileExistsInFolder}
                                        onClick={handleNext}>
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
                                            {selectedDevfile ? ('Selected Devfile') : ('Recommended Devfile')}
                                        </Typography>
                                        <DevfileRecommendationInfo />
                                    </Stack>
                                    <DevfileListItem devfile={selectedDevfile ? (selectedDevfile) : (recommendedDevfile.devfile)} />
                                    <Stack direction='row' justifyContent='flex-end' spacing={1} marginTop={2}>
                                        <Button
                                        variant='text'
                                        onClick={() => {
                                            setRecommendedDevfile((prevState) => ({ ...prevState, showRecommendation: false }));
                                            setSelectedDevfile(undefined);
                                         }}
                                        sx={{ marginRight: 'auto' }}>
                                            BACK
                                        </Button>
                                        <Button variant='text' onClick={() => { setCurrentPage('selectDifferentDevfile') }}>
                                            SELECT A DIFFERENT DEVFILE
                                        </Button>
                                        <LoadingButton variant='contained' disabled={isLoading} loading={isLoading} onClick={handleCreateComponent}>
                                            CREATE COMPONENT
                                        </LoadingButton>
                                    </Stack >
                                </Stack >
                            </>
                        )}
                    </Stack>
                </>
            );
        case 'selectDifferentDevfile':
            return (
                <>
                    {!selectedDevfile ? (
                        <DevfileSearch
                            titleText="Select Different Devfile"
                            goBack={() => {
                                setCurrentPage('fromLocalCodeBase')
                            }}
                            setSelectedDevfile={setSelectedDevfile}
                        />
                    ) : (
                        setCurrentPage('fromLocalCodeBase')
                    )
                    }
                </>
            );
    }
}
