/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button, CircularProgress,
    Divider,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import * as React from 'react';
import { Devfile } from '../../common/devfile';
import { DevfileListItem } from '../../common/devfileListItem';
import { DevfileRecommendationInfo } from '../../common/devfileRecommendationInfo';
import { DevfileSearch } from '../../common/devfileSearch';
import { NoSuitableDevfile } from '../../common/noSuitableDevfile';
import { SetNameAndFolder } from '../../common/setNameAndFolder';

type Message = {
    action: string;
    data: any;
};

type RecommendedDevfileState = {
    devfile: Devfile;
    showRecommendation: boolean;
    isLoading: boolean;
    isDevfileExistsInRepo: boolean;
    noRecommendation: boolean;
};

type GitURLState = {
    url: string;
    isValid: boolean;
    helpText: string;
};

type CurrentPage = 'fromGitRepo' | 'setNameAndFolder' | 'selectDifferentDevfile';

export function FromExistingGitRepo({ setCurrentView }) {
    const [currentPage, setCurrentPage] = React.useState<CurrentPage>('fromGitRepo');
    const [gitURL, setGitURL] = React.useState<GitURLState>({
        url: '',
        isValid: true,
        helpText: 'Please enter a Git URL.',
    });
    const [branchOption, setBranchOption] = React.useState<string>(undefined);
    const [cloneFailed, setCloneFailed] = React.useState(false);

    const [recommendedDevfile, setRecommendedDevfile] = React.useState<RecommendedDevfileState>({
        devfile: undefined,
        showRecommendation: false,
        isLoading: false,
        isDevfileExistsInRepo: false,
        noRecommendation: false,
    });
    const [selectedDevfile, setSelectedDevfile] = React.useState<Devfile>(undefined);

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'recommendedDevfile': {
                if (!message.data.devfile) {
                    setRecommendedDevfile((prevState) => ({
                        ...prevState,
                        noRecommendation: true,
                    }));
                    setRecommendedDevfile((prevState) => ({
                        ...prevState,
                        showRecommendation: true,
                    }));
                } else {
                    setRecommendedDevfile((prevState) => ({
                        ...prevState,
                        devfile: message.data.devfile,
                    }));
                    setRecommendedDevfile((prevState) => ({
                        ...prevState,
                        showRecommendation: true,
                    }));
                    setRecommendedDevfile((prevState) => ({ ...prevState, isLoading: false }));
                }
                break;
            }
            case 'validateGitURL': {
                setGitURL((prevState) => ({ ...prevState, isValid: message.data.isValid }));
                setGitURL((prevState) => ({ ...prevState, helpText: message.data.helpText }));
                break;
            }
            case 'devfileExists': {
                setRecommendedDevfile((prevState) => ({
                    ...prevState,
                    isDevfileExistsInRepo: message.data,
                }));
                break;
            }
            case 'cloneFailed': {
                setCloneFailed(true);
                break;
            }
            default:
                break;
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
            data: {
                url: gitURL.url,
                branch: branchOption,
            },
        });
        setRecommendedDevfile((prevState) => ({ ...prevState, isLoading: true }));
    }

    function createComponentFromGitRepo(
        projectFolder: string,
        componentName: string,
        addToWorkspace: boolean,
    ) {
        window.vscodeApi.postMessage({
            action: 'createComponent',
            data: {
                devfileDisplayName: selectedDevfile
                    ? selectedDevfile.name
                    : recommendedDevfile.devfile.name,
                componentName,
                gitDestinationPath: projectFolder,
                isFromTemplateProject: false,
                addToWorkspace,
            },
        });
    }

    switch (currentPage) {
        case 'fromGitRepo':
            return (
                <>
                    <div style={{ position: 'relative' }}>
                        <Typography variant="h5">Existing Remote Git Repository</Typography>
                    </div>
                    <Stack direction="column" spacing={2} marginTop={4}>
                        <TextField
                            fullWidth
                            variant="outlined"
                            label="Link to Git Repository"
                            value={gitURL.url}
                            disabled={
                                recommendedDevfile.showRecommendation ||
                                recommendedDevfile.isLoading
                            }
                            error={!gitURL.isValid}
                            helperText={gitURL.helpText}
                            onChange={(e) => {
                                window.vscodeApi.postMessage({
                                    action: 'validateGitURL',
                                    data: e.target.value,
                                });
                                setGitURL((prevState) => ({ ...prevState, url: e.target.value }));
                            }}
                        />
                        <Accordion className="accordion">
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>Advanced Options</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <TextField
                                    fullWidth
                                    id="outlined"
                                    value={branchOption}
                                    disabled={
                                        recommendedDevfile.showRecommendation ||
                                        recommendedDevfile.isLoading
                                    }
                                    label="Git Reference"
                                    helperText="Branch, tag, or commit to checkout"
                                    onChange={(e) => {
                                        setBranchOption(e.target.value);
                                    }}
                                ></TextField>
                            </AccordionDetails>
                        </Accordion>
                        {!recommendedDevfile.showRecommendation ? (
                            <>
                                {!cloneFailed ? (
                                    <>
                                        <Stack direction="row" spacing={2} marginTop={2}>
                                            <Button
                                                variant="text"
                                                onClick={() => {
                                                    setCurrentView('home');
                                                }}
                                                disabled={recommendedDevfile.isLoading}
                                            >
                                                BACK
                                            </Button>
                                            <Button
                                                variant="contained"
                                                onClick={handleNext}
                                                disabled={
                                                    gitURL.url.length === 0 ||
                                                    !gitURL.isValid ||
                                                    recommendedDevfile.isLoading
                                                }
                                            >
                                                NEXT
                                            </Button>
                                        </Stack>
                                        {recommendedDevfile.isLoading && (
                                            <Stack
                                                direction="column"
                                                spacing={2}
                                                alignItems="center"
                                            >
                                                <CircularProgress />
                                                <Typography variant="body2">
                                                    Cloning git repository and scanning for
                                                    recommended devfile.
                                                </Typography>
                                            </Stack>
                                        )}
                                    </>
                                ) : (
                                    <Stack direction="column" spacing={2} marginTop={2}>
                                        <Alert severity="error">
                                            Failed to clone project. Please try again or manually
                                            select a devfile.
                                        </Alert>
                                        <Stack
                                            direction="row"
                                            justifyContent="flex-end"
                                            marginTop={2}
                                            spacing={1}
                                        >
                                            <Button
                                                variant="text"
                                                onClick={() => {
                                                    setRecommendedDevfile((prevState) => ({
                                                        ...prevState,
                                                        showRecommendation: false,
                                                    }));
                                                    setRecommendedDevfile((prevState) => ({
                                                        ...prevState,
                                                        isLoading: false,
                                                    }));
                                                    setSelectedDevfile(undefined);
                                                    setCloneFailed(false);
                                                    window.vscodeApi.postMessage({
                                                        action: 'deleteClonedRepo',
                                                    });
                                                }}
                                                sx={{ marginRight: 'auto' }}
                                            >
                                                BACK
                                            </Button>
                                        </Stack>
                                    </Stack>
                                )}
                            </>
                        ) : recommendedDevfile.noRecommendation ? (
                            <>
                                <NoSuitableDevfile />
                                <Stack
                                    direction="row"
                                    justifyContent="flex-end"
                                    marginTop={2}
                                    spacing={1}
                                >
                                    <Button
                                        variant="text"
                                        onClick={() => {
                                            setRecommendedDevfile((prevState) => ({
                                                ...prevState,
                                                showRecommendation: false,
                                            }));
                                            setRecommendedDevfile((prevState) => ({
                                                ...prevState,
                                                isLoading: false,
                                            }));
                                            setSelectedDevfile(undefined);
                                            setCloneFailed(false);
                                            window.vscodeApi.postMessage({
                                                action: 'deleteClonedRepo',
                                            });
                                        }}
                                        sx={{ marginRight: 'auto' }}
                                    >
                                        BACK
                                    </Button>
                                    <Button
                                        variant="contained"
                                        disabled={cloneFailed}
                                        onClick={() => {
                                            setCloneFailed(false);
                                            setRecommendedDevfile((prevState) => ({
                                                ...prevState,
                                                showRecommendation: true,
                                            }));
                                            setCurrentPage('selectDifferentDevfile');
                                        }}
                                    >
                                        SELECT A DEVFILE
                                    </Button>
                                </Stack>
                            </>
                        ) : (
                            <>
                                <Divider variant="middle" sx={{ marginTop: '2em' }} />
                                <Stack direction="column">
                                    <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        marginTop={1}
                                    >
                                        <Typography variant="h6">
                                            {selectedDevfile
                                                ? 'Selected Devfile'
                                                : 'Recommended Devfile'}
                                        </Typography>
                                        {!recommendedDevfile.isDevfileExistsInRepo && (
                                            <DevfileRecommendationInfo />
                                        )}
                                    </Stack>
                                    {recommendedDevfile.isDevfileExistsInRepo ? (
                                        <Box margin={2}>
                                            <Alert severity="info">
                                                The Devfile that exists in the repo will be used
                                            </Alert>
                                        </Box>
                                    ) : (
                                        <DevfileListItem
                                            devfile={
                                                selectedDevfile
                                                    ? selectedDevfile
                                                    : recommendedDevfile.devfile
                                            }
                                        />
                                    )}
                                    <Stack
                                        direction="row"
                                        justifyContent="flex-end"
                                        marginTop={2}
                                        spacing={1}
                                    >
                                        <Button
                                            variant="text"
                                            onClick={() => {
                                                setRecommendedDevfile((prevState) => ({
                                                    ...prevState,
                                                    isLoading: false,
                                                }));
                                                setSelectedDevfile(undefined);
                                                setCloneFailed(false);
                                                setRecommendedDevfile((prevState) => ({
                                                    ...prevState,
                                                    showRecommendation: false,
                                                }));
                                                window.vscodeApi.postMessage({
                                                    action: 'deleteClonedRepo',
                                                });
                                            }}
                                            sx={{ marginRight: 'auto' }}
                                        >
                                            BACK
                                        </Button>
                                        {!recommendedDevfile.isDevfileExistsInRepo && (
                                            <Button
                                                variant="contained"
                                                onClick={() => {
                                                    setSelectedDevfile(undefined);
                                                    setCurrentPage('selectDifferentDevfile');
                                                }}
                                            >
                                                SELECT A DIFFERENT DEVFILE
                                            </Button>
                                        )}
                                        <Button
                                            variant="contained"
                                            onClick={() => {
                                                setCurrentPage('setNameAndFolder');
                                            }}
                                        >
                                            CONTINUE WITH THIS DEVFILE
                                        </Button>
                                    </Stack>
                                </Stack>
                            </>
                        )}
                    </Stack>
                </>
            );
        case 'setNameAndFolder':
            return (
                <SetNameAndFolder
                    goBack={() => {
                        setCurrentPage('fromGitRepo');
                    }}
                    createComponent={createComponentFromGitRepo}
                    devfile={recommendedDevfile.isDevfileExistsInRepo ? undefined : selectedDevfile ? selectedDevfile : recommendedDevfile.devfile}
                    initialComponentName={gitURL.url.substring(gitURL.url.lastIndexOf('/') + 1)}
                />
            );
        case 'selectDifferentDevfile':
            return (
                <>
                    {!selectedDevfile ? (
                        <DevfileSearch
                            titleText="Select Different Devfile"
                            goBack={() => {
                                setCurrentPage('fromGitRepo');
                            }}
                            setSelectedDevfile={setSelectedDevfile}
                        />
                    ) : (
                        setCurrentPage('fromGitRepo')
                    )}
                </>
            );
        default:
            break;
    }
}
