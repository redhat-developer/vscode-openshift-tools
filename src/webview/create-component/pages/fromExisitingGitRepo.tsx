import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Button, CircularProgress, Divider, Stack, TextField, Typography } from "@mui/material";
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

type RecommendedDevfileState = {
    devfile: Devfile
    showRecommendation: boolean;
    isLoading: boolean;
    isDevfileExistsInRepo: boolean;
}

type ComponentNameState = {
    name: string
    isValid: boolean;
    helpText: string;
}

type GitURLState = {
    url: string
    isValid: boolean;
    helpText: string;
}

type ProjectPathState = {
    path: string
    isValid: boolean;
    helpText: string;
}

export function FromExistingGitRepo({ setCurrentView }) {
    const [gitURL, setGitURL] = React.useState<GitURLState>({
        url: '',
        isValid: false,
        helpText: 'Please enter a Git URL.'
    });
    const [showConfirmationPage, setShowConfirmationPage] = React.useState(false);
    const [tmpDir, setTmpDir] = React.useState<Uri>();
    const [recommendedDevfile, setRecommendedDevfile] = React.useState<RecommendedDevfileState>({
        devfile: undefined,
        showRecommendation: false,
        isLoading: false,
        isDevfileExistsInRepo: false
    });
    const [componentName, setComponentName] = React.useState<ComponentNameState>({
        name: '',
        isValid: false,
        helpText: 'Please enter a component name.'
    });

    const [projectFolder, setProjectFolder] = React.useState<ProjectPathState>({
        path: '',
        isValid: false,
        helpText: 'Please enter a folder path or select a folder.'
    });

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'recommendedDevfile': {
                setRecommendedDevfile((prevState) => ({ ...prevState, devfile: message.data.devfile }));
                setRecommendedDevfile((prevState) => ({ ...prevState, showRecommendation: true }));
                setRecommendedDevfile((prevState) => ({ ...prevState, isLoading: false }));
                setTmpDir(message.data.tmpDir);
                break;
            }
            case 'validateGitURL': {
                setGitURL((prevState) => ({ ...prevState, isValid: message.data.isValid }));
                setGitURL((prevState) => ({ ...prevState, helpText: message.data.helpText }));
                break;
            }
            case 'validatedComponentName': {
                if (message.data) {
                    setComponentName((prevState) => ({ ...prevState, isValid: false }));
                    setComponentName((prevState) => ({ ...prevState, validationMessage: message.data }));

                } else {
                    setComponentName((prevState) => ({ ...prevState, isValid: true }));
                }
                break;
            }
            case 'selectedProjectFolder': {
                if (message.data) {
                    setProjectFolder((prevState) => ({ ...prevState, path: message.data, isValid: true }));
                }
                break;
            }
            case 'devfileExists': {
                setRecommendedDevfile((prevState) => ({ ...prevState, isDevfileExistsInRepo: message.data }));
                break;
            }
            case 'validatedFolderPath': {
                setProjectFolder((prevState) => ({ ...prevState, isValid: message.data.isValid, helpText: message.data.helpText }));
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
            action: 'getRecommendedDevfileFromGit',
            data: gitURL.url
        });
        setRecommendedDevfile((prevState) => ({ ...prevState, isLoading: true }));
    };

    function handleCreateComponent() {
        window.vscodeApi.postMessage({
            action: 'createComponent',
            data: {
                devfileDisplayName: recommendedDevfile.devfile.name,
                componentName: componentName.name,
                tmpDirUri: tmpDir,
                gitDestinationPath: projectFolder.path
            }
        });
    };

    return (
        <>
            {!showConfirmationPage ? (
                <>
                    <div style={{ position: 'relative', marginTop: '5em' }}>
                        <Typography variant='h5'>
                            Existing Remote Git Repository
                        </Typography>
                    </div>
                    <Stack direction='column' spacing={2} marginTop={2}>
                        <TextField fullWidth
                            variant='outlined'
                            label='Link to Git Repository'
                            value={gitURL.url}
                            disabled={recommendedDevfile.showRecommendation}
                            error={!gitURL.isValid}
                            helperText={!gitURL.isValid && gitURL.helpText}
                            onChange={(e) => {
                                window.vscodeApi.postMessage({
                                    action: 'validateGitURL',
                                    data: e.target.value
                                });
                                setGitURL((prevState) => ({ ...prevState, url: e.target.value }));
                            }}
                        />
                        <Accordion className='accordion'>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>Advanced Options</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <TextField fullWidth
                                    id='outlined'
                                    disabled={recommendedDevfile.showRecommendation}
                                    label='Git Reference'
                                    helperText='Branch, tag, or commit to checkout'>
                                </TextField>
                                <TextField fullWidth
                                    id='outlined'
                                    disabled={recommendedDevfile.showRecommendation}
                                    label='Context Directory'
                                    helperText='Subdirectory for the source code, used as a context directory for building the component'>
                                </TextField>
                            </AccordionDetails>
                        </Accordion>
                        {!recommendedDevfile.showRecommendation ? (
                            <>
                                <Stack direction='row' spacing={2} marginTop={2}>
                                    <Button variant='text' onClick={() => { setCurrentView('home') }}>
                                        BACK
                                    </Button>
                                    <Button variant='contained' onClick={handleNext}>
                                        NEXT
                                    </Button>
                                </Stack>
                                {recommendedDevfile.isLoading &&
                                    <Stack direction='column' spacing={2} alignItems='center'>
                                        <Divider variant="middle" sx={{ marginTop: '2em' }} />
                                        <CircularProgress />
                                        Cloning git repository and scanning for recommended devfile.
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
                                    <Stack direction='row' justifyContent='flex-end' marginTop={1}>
                                        <Button variant='text' onClick={() => { setRecommendedDevfile((prevState) => ({ ...prevState, showRecommendation: false })) }} sx={{ marginRight: 'auto' }}>
                                            BACK
                                        </Button>
                                        <Button variant='text' onClick={() => { setCurrentView('devfileSearch') }}>
                                            SELECT A DIFFERENT DEVFILE
                                        </Button>
                                        <Button variant='contained' onClick={() => { setShowConfirmationPage(true) }}>
                                            CONTINUE WITH THIS DEVFILE
                                        </Button>
                                    </Stack >
                                </Stack >
                            </>
                        )}
                    </Stack>
                </>
            ) : (
                <Stack direction='column'>
                    <div style={{ position: 'relative', marginTop: '5em' }}>
                        <Typography variant='h5'>
                            Select Name and Folder
                        </Typography>
                    </div>
                    <div style={{ marginTop: '2em', marginBottom: '2em' }}>
                        <DevfileListItem devfile={recommendedDevfile.devfile} />
                    </div>
                    <ComponentNameInput componentName={componentName} setComponentName={setComponentName} ></ComponentNameInput>
                    <Stack direction='column' spacing={2}>
                        <TextField fullWidth
                            className='selectFolder'
                            value={projectFolder.path}
                            label="Folder"
                            onChange={(e) => {
                                window.vscodeApi.postMessage({
                                    action: 'validateFolderPath',
                                    data: e.target.value
                                });
                                setProjectFolder((prevState) => ({ ...prevState, path: e.target.value as string }))
                            }}
                            error={!projectFolder.isValid}
                            helperText={!projectFolder.isValid && projectFolder.helpText}
                            sx={{ width: '100%' }} >
                        </TextField>
                        <Button variant='contained' onClick={() => { window.vscodeApi.postMessage({ action: 'selectProjectFolder' }) }} sx={{ height: '4em', width: '10%' }} > SELECT FOLDER </Button>
                    </Stack>
                    <Stack direction='row' spacing={1} justifyContent='space-between'>
                        <Button variant='text' onClick={() => { setShowConfirmationPage(false) }} sx={{ marginRight: 'auto' }}>
                            BACK
                        </Button>
                        <Button variant='contained' onClick={handleCreateComponent}>
                            CREATE COMPONENT
                        </Button>
                    </Stack >
                </Stack>
            )}
        </>
    );
}
