import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Button, CircularProgress, Divider, Stack, TextField, Typography } from "@mui/material";
import * as React from 'react';
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
    validationMessage: string;
}

type GitURLState = {
    gitURL: string
    isValid: boolean;
    helpText: string;
}

export function FromExistingGitRepo({ setCurrentView }) {
    const [gitURL, setGitURL] = React.useState<GitURLState>({
        gitURL: '',
        isValid: false,
        helpText: 'Please enter a Git URL.'
    });
    const [projectFolder, setProjectFolder] = React.useState('');
    const [recommendedDevfile, setRecommendedDevfile] = React.useState<RecommendedDevfileState>({
        devfile: undefined,
        showRecommendation: false,
        isLoading: false,
        isDevfileExistsInRepo: false
    });
    const [componentName, setComponentName] = React.useState<ComponentNameState>({
        name: '',
        isValid: true,
        validationMessage: 'Please enter a component name.'
    });

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'recommendedDevfile': {
                setRecommendedDevfile((prevState) => ({ ...prevState, devfile: message.data }));
                setRecommendedDevfile((prevState) => ({ ...prevState, showRecommendation: true }));
                setRecommendedDevfile((prevState) => ({ ...prevState, isLoading: false }));
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
                    setProjectFolder(message.data.path);
                }
                break;
            }
            case 'devfileExists': {
                setRecommendedDevfile((prevState) => ({ ...prevState, isDevfileExistsInRepo: message.data }));
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
            data: gitURL
        });
        setRecommendedDevfile((prevState) => ({ ...prevState, isLoading: true }));
    };

    function handleCreateComponent() {
        window.vscodeApi.postMessage({
            action: 'createComponent',
            data: {
                devfileDisplayName: recommendedDevfile.devfile.name,
                componentName: componentName.name,
                path: projectFolder
            }
        });
    };

    return (
        <>
            <div style={{ position: 'relative', marginTop: '5em' }}>
                <Typography variant='h5'>
                    Existing Remote Git Repository
                </Typography>
            </div>
            <Stack direction='column' spacing={2}>
                <div style={{ marginTop: '2em' }}>
                    <TextField
                        variant='outlined'
                        label='Link to Git Repository'
                        disabled={recommendedDevfile.showRecommendation}
                        error={!gitURL.isValid}
                        helperText={!gitURL.isValid && gitURL.helpText}
                        onChange={(e) => {
                            window.vscodeApi.postMessage({
                                action: 'validateGitURL',
                                data: e.target.value
                            });
                            setGitURL((prevState) => ({ ...prevState, gitURL: e.target.value }));
                        }}
                        fullWidth
                    />
                </div>
                <Accordion className='accordion'>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>Advanced Options</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Stack direction='row' spacing={2} width='100%'>
                            <TextField
                                id='outlined'
                                disabled={recommendedDevfile.showRecommendation}
                                label='Git Reference'
                                helperText='Branch, tag, or commit to checkout'>
                            </TextField>
                            <TextField
                                id='outlined'
                                disabled={recommendedDevfile.showRecommendation}
                                label='Context Directory'
                                helperText='Subdirectory for the source code, used as a context directory for building the component'>
                            </TextField>
                        </Stack>
                    </AccordionDetails>
                </Accordion>
                {!recommendedDevfile.showRecommendation ? (
                    <>
                        <div style={{ marginTop: '2em' }}>
                            <Button variant='text' onClick={() => { setCurrentView('home') }}>
                                BACK
                            </Button>
                            <Button variant='contained' onClick={handleNext}>
                                NEXT
                            </Button>
                        </div>
                        {recommendedDevfile.isLoading &&
                            <Stack direction='column' spacing={2} alignItems='center'>
                                <Divider variant="middle" sx={{ marginTop: '2em' }} />
                                <CircularProgress />
                                Cloning git repository and scanning for recommended devfile.
                            </Stack>
                        }
                    </>
                ) : (
                    <div>
                        <Divider variant="middle" sx={{ marginTop: '2em' }} />
                        <Stack direction='column'>
                            <div style={{ display: 'flex', marginTop: '1.5em', justifyContent: 'space-between' }}>
                                <Typography variant='h6'>
                                    Recommended Devfile
                                </Typography>
                                <DevfileRecommendationInfo />
                            </div>
                            <DevfileListItem devfile={recommendedDevfile.devfile} />
                            <div style={{ display: 'flex', gap: '1em', marginTop: '1.5em', justifyContent: 'flex-end' }}>
                                <Button variant='text' onClick={() => { setRecommendedDevfile((prevState) => ({ ...prevState, showRecommendation: false })) }} sx={{ marginRight: 'auto' }}>
                                    BACK
                                </Button>
                                <Button variant='text' onClick={() => { setCurrentView('devfileSearch') }}>
                                    SELECT A DIFFERENT DEVFILE
                                </Button>
                                <Button variant='contained' onClick={handleCreateComponent}>
                                    CONTINUE WITH THIS DEVFILE
                                </Button>
                            </div >
                        </Stack >
                    </div>
                )}
            </Stack>
        </>
    );
}
