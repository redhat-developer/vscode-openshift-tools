import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Button, CircularProgress, Divider, Stack, TextField, Typography } from "@mui/material";
import * as React from 'react';
import { Uri } from 'vscode';
import { Devfile } from '../../common/devfile';
import { DevfileListItem } from '../../common/devfileListItem';
import { DevfileRecommendationInfo } from '../../common/devfileRecommendationInfo';
import { SetNameAndFolder } from '../../common/setNameAndFolder';
import { DevfileSearch } from '../../common/devfileSearch';

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

type GitURLState = {
    url: string
    isValid: boolean;
    helpText: string;
}

type CurrentPage = 'fromGitRepo' | 'setNameAndFolder' | 'selectDifferentDevfile';

export function FromExistingGitRepo({ setCurrentView }) {
    const [currentPage, setCurrentPage] = React.useState<CurrentPage>('fromGitRepo');
    const [gitURL, setGitURL] = React.useState<GitURLState>({
        url: '',
        isValid: true,
        helpText: 'Please enter a Git URL.'
    });

    const [tmpDir, setTmpDir] = React.useState<Uri>();
    const [recommendedDevfile, setRecommendedDevfile] = React.useState<RecommendedDevfileState>({
        devfile: undefined,
        showRecommendation: false,
        isLoading: false,
        isDevfileExistsInRepo: false
    });
    const [selectedDevfile, setSelectedDevfile] = React.useState<Devfile>();

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
            data: gitURL.url
        });
        setRecommendedDevfile((prevState) => ({ ...prevState, isLoading: true }));
    };

    function createComponentFromGitRepo(projectFolder: string, componentName: string) {
        window.vscodeApi.postMessage({
            action: 'createComponent',
            data: {
                devfileDisplayName: selectedDevfile ? (selectedDevfile.name) : (recommendedDevfile.devfile.name),
                componentName: componentName,
                tmpDirUri: tmpDir,
                gitDestinationPath: projectFolder
            }
        });
    }

    switch (currentPage) {
        case 'fromGitRepo':
            return (
                <>
                    <div style={{ position: 'relative' }}>
                        <Typography variant='h5'>
                            Existing Remote Git Repository
                        </Typography>
                    </div>
                    <Stack direction='column' spacing={2} marginTop={4}>
                        <TextField fullWidth
                            variant='outlined'
                            label='Link to Git Repository'
                            value={gitURL.url}
                            disabled={recommendedDevfile.showRecommendation || recommendedDevfile.isLoading}
                            error={!gitURL.isValid}
                            helperText={gitURL.helpText}
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
                                <Stack direction='column' spacing={2}>
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
                                </Stack>
                            </AccordionDetails>
                        </Accordion>
                        {!recommendedDevfile.showRecommendation ? (
                            <>
                                <Stack direction='row' spacing={2} marginTop={2}>
                                    <Button
                                        variant='text'
                                        onClick={() => { setCurrentView('home') }}
                                        disabled={recommendedDevfile.isLoading}>
                                        BACK
                                    </Button>
                                    <Button
                                        variant='contained'
                                        onClick={handleNext}
                                        disabled={gitURL.url.length === 0 || !gitURL.isValid || recommendedDevfile.isLoading}>
                                        NEXT
                                    </Button>
                                </Stack>
                                {recommendedDevfile.isLoading &&
                                    <Stack direction='column' spacing={2} alignItems='center'>
                                        <CircularProgress />
                                        <Typography variant='body2'>
                                            Cloning git repository and scanning for recommended devfile.
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
                                    <Stack direction='row' justifyContent='flex-end' marginTop={2} spacing={1}>
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
                                        <Button variant='contained' onClick={() => { setCurrentPage('setNameAndFolder') }}>
                                            CONTINUE WITH THIS DEVFILE
                                        </Button>
                                    </Stack >
                                </Stack >
                            </>
                        )}
                    </Stack>
                </>
            );
        case 'setNameAndFolder':
            return (
                <SetNameAndFolder
                    goBack={() => {
                        setCurrentPage('fromGitRepo')
                    }}
                    createComponent={createComponentFromGitRepo}
                    devfile={selectedDevfile ? (selectedDevfile) : (recommendedDevfile.devfile)}
                />
            );
        case 'selectDifferentDevfile':
            return (
                <>
                    {!selectedDevfile ? (
                        <DevfileSearch
                            titleText="Select Different Devfile"
                            goBack={() => {
                                setCurrentPage('fromGitRepo')
                            }}
                            setSelectedDevfile={setSelectedDevfile}
                        />
                    ) : (
                        setCurrentPage('fromGitRepo')
                    )
                    }
                </>
            );
    }
}
