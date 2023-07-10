import { Button, CircularProgress, Divider, FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import * as React from 'react';
import { Uri } from 'vscode';
import { Devfile } from '../../common/devfile';
import { DevfileListItem } from '../../common/devfileListItem';
import { DevfileRecommendationInfo } from '../../common/devfileRecommendationInfo';

type Message = {
    action: string;
    data: any;
}

export function FromLocalCodebase({ setCurrentView }) {
    const [workspaceFolders, setWorkspaceFolders] = React.useState<Uri[]>([]);
    const [componentName, setComponentName] = React.useState('');
    const [projectFolder, setProjectFolder] = React.useState('');
    const [recommendedDevfile, setRecommendedDevfile] = React.useState<Devfile>();
    const [showRecommendedDevfile, setShowRecommendedDevfile] = React.useState(false);
    const [isComponentNameInvalid, setIsComponentNameInvalid] = React.useState(true);
    const [validationMessage, setValidationMessage] = React.useState('Please enter a component name.');
    const [isDevfileExistsInFolder, setIsDevfileExistsInFolder] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'workspaceFolders': {
                setWorkspaceFolders(_workspaceFolders => message.data);
                break;
            }
            case 'recommendedDevfile': {
                const devfile: Devfile = {
                    ...message.data,
                };
                setRecommendedDevfile(devfile);
                setShowRecommendedDevfile(true);
                setIsLoading(false);
                break;
            }
            case 'validatedComponentName': {
                if (message.data) {
                    setIsComponentNameInvalid(true);
                    setValidationMessage(message.data);
                } else {
                    setIsComponentNameInvalid(false);
                }
                break;
            }
            case 'selectedProjectFolder': {
                if (message.data) {
                    setProjectFolder(message.data.path);
                }
                break;
            }
            case 'devfileExists': {
                setIsDevfileExistsInFolder(message.data);
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
        setIsLoading(true);
    };

    function handleCreateComponent() {
        window.vscodeApi.postMessage({
            action: 'createComponent',
            data: {
                devfileDisplayName: recommendedDevfile.name,
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
            <Stack direction='column' spacing={2} marginTop={3}>
                <TextField
                    sx={{ flexGrow: 1 }}
                    id='componentName'
                    variant='outlined'
                    label='Component Name'
                    error={isComponentNameInvalid}
                    helperText={isComponentNameInvalid && validationMessage}
                    onChange={(e) => {
                        window.vscodeApi.postMessage({
                            action: 'validateComponentName',
                            data: e.target.value
                        });
                        setComponentName(e.target.value);
                    }}
                />
                <div style={{ display: 'flex', flexDirection: 'row', gap: '1em', marginTop: '1em' }}>
                    <FormControl fullWidth error={isDevfileExistsInFolder} >
                        <InputLabel id="project-path-label">Folder</InputLabel>
                        <Select
                            className='selectFolder'
                            labelId="project-path-label"
                            value={projectFolder}
                            label="Folder"
                            onChange={(e) => { setProjectFolder(e.target.value as string) }}
                            disabled={showRecommendedDevfile || workspaceFolders.length === 0}
                            sx={{ width: '100%' }} >
                            {workspaceFolders.length !== 0 && workspaceFolders.map((uri) => (
                                <MenuItem key={uri.path} value={uri.path}>
                                    {uri.path}
                                </MenuItem>
                            ))}
                        </Select>
                        {isDevfileExistsInFolder &&
                            <FormHelperText>A devfile already exists in this project, please select another folder.</FormHelperText>}
                        {workspaceFolders.length === 0 &&
                            <FormHelperText>There are no projects in the workspace, select folder or open a folder in the workspace.</FormHelperText>}
                    </FormControl>
                    {!showRecommendedDevfile &&
                        <Button variant='contained' onClick={() => { window.vscodeApi.postMessage({ action: 'selectProjectFolder' }) }} sx={{ height: '4em', width: '10%' }} > SELECT FOLDER </Button>}
                </div>
                {!showRecommendedDevfile ? (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'row', gap: '1em', marginTop: '1em' }}>
                            <Button variant='text' onClick={() => { setCurrentView('home') }}>
                                BACK
                            </Button>
                            <Button variant='contained' disabled={isComponentNameInvalid || projectFolder.length === 0 || isDevfileExistsInFolder} onClick={handleNext}>
                                NEXT
                            </Button>
                        </div>
                        {isLoading &&
                            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignSelf: 'center', gap: '2em'}}>
                                <Divider variant="middle" sx={{ marginTop: '2em' }} />
                                <CircularProgress />
                                Scanning for recommended devfile.
                            </div>
                        }
                    </>
                ) : (
                    <div>
                        <Divider variant="middle" sx={{ marginTop: '2em' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', marginTop: '1.5em', justifyContent: 'space-between' }}>
                                <Typography variant='h6'>
                                    Recommended Devfile for {componentName}
                                </Typography>
                                <DevfileRecommendationInfo />
                            </div>
                            <DevfileListItem devfile={recommendedDevfile} />
                            <div style={{ display: 'flex', gap: '1em', marginTop: '1.5em', justifyContent: 'flex-end' }}>
                                <Button variant='text' onClick={() => { setShowRecommendedDevfile(false) }} sx={{ marginRight: 'auto' }}>
                                    BACK
                                </Button>
                                <Button variant='text' onClick={() => { setCurrentView('devfileSearch') }}>
                                    SELECT A DIFFERENT DEVFILE
                                </Button>
                                <Button variant='contained' onClick={handleCreateComponent}>
                                    CREATE COMPONENT
                                </Button>
                            </div >
                        </div >
                    </div>
                )}
            </Stack>
        </>
    );
}
