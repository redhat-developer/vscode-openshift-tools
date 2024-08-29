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
import { RecommendationInfo } from '../../common/devfileRecommendationInfo';
import { NoSuitableWarning } from '../../common/noSuitableDevfile';
import { BuilderImage } from '../../common/buildImage';
import { BuilderImageListItem } from '../../common/builderImageListItem';
import { BuilderConfiguration } from './builderConfig';
import { SelectBuilderImage } from './selectBuilderImage';

type Message = {
    action: string;
    data: any;
};

type RecommendedBuilderImageState = {
    builderImage: BuilderImage;
    showRecommendation: boolean;
    isLoading: boolean;
    completionValue: number;
    isBuilderImageExistsInRepo: boolean;
    noRecommendation: boolean;
};

type GitURLState = {
    url: string;
    isValid: boolean;
    helpText: string;
};

type CurrentPage = 'fromGitRepo' | 'setNameAndFolder' | 'selectDifferentBuilderImage';

export function FromExistingGitRepo({ setCurrentView }) {
    const [currentPage, setCurrentPage] = React.useState<CurrentPage>('fromGitRepo');
    const [gitURL, setGitURL] = React.useState<GitURLState>({
        url: '',
        isValid: true,
        helpText: 'Please enter a Git URL.',
    });
    const [branchOption, setBranchOption] = React.useState<string>(undefined);
    const [cloneFailed, setCloneFailed] = React.useState(false);

    const [recommendedBuilderImage, setRecommendedBuilderImage] = React.useState<RecommendedBuilderImageState>({
        builderImage: undefined,
        showRecommendation: false,
        isLoading: false,
        completionValue: 0,
        isBuilderImageExistsInRepo: false,
        noRecommendation: false,
    });
    const [builderImages, setBuilderImages] = React.useState<BuilderImage[]>([]);
    const [selectedBuilderImage, setSelectedBuilderImage] = React.useState<BuilderImage>(undefined);

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'recommendedBuilderImage': {
                if(message.data.builderImages) {
                    setBuilderImages(message.data.builderImages);
                }
                if (!message.data.receommendedBuilderImage) {
                    setRecommendedBuilderImage((prevState) => ({
                        ...prevState,
                        noRecommendation: true,
                    }));
                    setRecommendedBuilderImage((prevState) => ({
                        ...prevState,
                        showRecommendation: true,
                    }));
                } else {
                    setRecommendedBuilderImage((prevState) => ({
                        ...prevState,
                        completionValue: 100,
                    }));
                    setRecommendedBuilderImage((prevState) => ({
                        ...prevState,
                        builderImage: message.data.receommendedBuilderImage,
                    }));
                    setRecommendedBuilderImage((prevState) => ({
                        ...prevState,
                        showRecommendation: true,
                    }));
                    setRecommendedBuilderImage((prevState) => ({ ...prevState, isLoading: false }));
                }
                break;
            }
            case 'validateGitURL': {
                setGitURL((prevState) => ({ ...prevState, isValid: message.data.isValid }));
                setGitURL((prevState) => ({ ...prevState, helpText: message.data.helpText }));
                break;
            }
            case 'cloneFailed': {
                setCloneFailed(true);
                break;
            }
            case 'cloneStart':
            case 'cloneExecution':
            case 'getRecommendedBuilderImageStart': {
                setRecommendedBuilderImage((prevState) => ({ ...prevState, completionValue: prevState.completionValue + 10 }));
                break;
            }
            case 'getRecommendedBuilderImage': {
                setRecommendedBuilderImage((prevState) => ({ ...prevState, completionValue: prevState.completionValue + 45 }));
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
            action: 'getRecommendedBuilderImageFromGit',
            data: {
                url: gitURL.url,
                branch: branchOption,
            },
        });
        setRecommendedBuilderImage((prevState) => ({ ...prevState, isLoading: true, completionValue: 5 }));
    }

    function getEffectiveBuilderImage() {
        return recommendedBuilderImage.isBuilderImageExistsInRepo ?
            recommendedBuilderImage.builderImage // An existing Git-Repo BuilderImage
            : selectedBuilderImage ?
                selectedBuilderImage // A selected BuilderImage
                : recommendedBuilderImage.builderImage // A recommended BuilderImage
    }

    function getName() {
        return gitURL.url.substring(gitURL.url.lastIndexOf('/') + 1);
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
                                recommendedBuilderImage.showRecommendation ||
                                recommendedBuilderImage.isLoading
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
                                        recommendedBuilderImage.showRecommendation ||
                                        recommendedBuilderImage.isLoading
                                    }
                                    label="Git Reference"
                                    helperText="Branch, tag, or commit to checkout"
                                    onChange={(e) => {
                                        setBranchOption(e.target.value);
                                    }}
                                ></TextField>
                            </AccordionDetails>
                        </Accordion>
                        {!recommendedBuilderImage.showRecommendation ? (
                            <>
                                {!cloneFailed ? (
                                    <>
                                        <Stack direction="row" spacing={2} marginTop={2}>
                                            <Button
                                                variant="contained"
                                                onClick={handleNext}
                                                disabled={
                                                    gitURL.url.length === 0 ||
                                                    !gitURL.isValid ||
                                                    recommendedBuilderImage.isLoading
                                                }
                                            >
                                                NEXT
                                            </Button>
                                        </Stack>
                                        {recommendedBuilderImage.isLoading && (
                                            <Stack
                                                direction="column"
                                                spacing={2}
                                                alignItems="center"
                                            >
                                                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                                                    <CircularProgress variant='determinate' value={recommendedBuilderImage.completionValue} />
                                                    <Box
                                                        sx={{
                                                            top: 0,
                                                            left: 0,
                                                            bottom: 0,
                                                            right: 0,
                                                            position: 'absolute',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }}
                                                    >
                                                        <Typography
                                                            variant='caption'
                                                            component='div'
                                                            color='text.secondary'
                                                        >{`${Math.round(recommendedBuilderImage.completionValue)}%`}</Typography>
                                                    </Box>
                                                </Box>
                                                <Typography variant="body2">
                                                    Cloning git repository and scanning for
                                                    recommended BuilderImage.
                                                </Typography>
                                            </Stack>
                                        )}
                                    </>
                                ) : (
                                    <Stack direction="column" spacing={2} marginTop={2}>
                                        <Alert severity="error">
                                            Failed to clone project. Please try again or manually
                                            select a Builder Image.
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
                                                    setRecommendedBuilderImage((prevState) => ({
                                                        ...prevState,
                                                        showRecommendation: false,
                                                    }));
                                                    setRecommendedBuilderImage((prevState) => ({
                                                        ...prevState,
                                                        isLoading: false,
                                                    }));
                                                    setSelectedBuilderImage(undefined);
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
                        ) : recommendedBuilderImage.noRecommendation && !selectedBuilderImage ? (
                            <>
                                <NoSuitableWarning isComponent={false} />
                                <Stack
                                    direction="row"
                                    justifyContent="flex-end"
                                    marginTop={2}
                                    spacing={1}
                                >
                                    <Button
                                        variant="text"
                                        onClick={() => {
                                            setRecommendedBuilderImage((prevState) => ({
                                                ...prevState,
                                                showRecommendation: false,
                                            }));
                                            setRecommendedBuilderImage((prevState) => ({
                                                ...prevState,
                                                isLoading: false,
                                            }));
                                            setSelectedBuilderImage(undefined);
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
                                            setRecommendedBuilderImage((prevState) => ({
                                                ...prevState,
                                                showRecommendation: true,
                                            }));
                                            setCurrentPage('selectDifferentBuilderImage');
                                        }}
                                    >
                                        SELECT A Builder Image
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
                                            {selectedBuilderImage
                                                ? 'Selected BuilderImage'
                                                : 'Recommended BuilderImage'}
                                        </Typography>
                                        {!recommendedBuilderImage.isBuilderImageExistsInRepo && (
                                            <RecommendationInfo infoMessage='Recommended based on a scan of build image of the project.'/>
                                        )}
                                    </Stack>
                                    {recommendedBuilderImage.isBuilderImageExistsInRepo ? (
                                        <Box margin={2}>
                                            <Alert severity="info">
                                                The BuilderImage that exists in the repo will be used
                                            </Alert>
                                        </Box>
                                    ) : (
                                        <BuilderImageListItem
                                            builderImage={
                                                selectedBuilderImage
                                                    ? selectedBuilderImage
                                                    : recommendedBuilderImage.builderImage
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
                                                setRecommendedBuilderImage((prevState) => ({
                                                    ...prevState,
                                                    isLoading: false,
                                                }));
                                                setSelectedBuilderImage(undefined);
                                                setCloneFailed(false);
                                                setRecommendedBuilderImage((prevState) => ({
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
                                        {!recommendedBuilderImage.isBuilderImageExistsInRepo && (
                                            <Button
                                                variant="contained"
                                                onClick={() => {
                                                    setSelectedBuilderImage(undefined);
                                                    setCurrentPage('selectDifferentBuilderImage');
                                                }}
                                            >
                                                SELECT A DIFFERENT Builder Image
                                            </Button>
                                        )}
                                        <Button
                                            variant="contained"
                                            onClick={() => {
                                                setCurrentPage('setNameAndFolder');
                                            }}
                                        >
                                            CONTINUE WITH THIS Builder Image
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
                <BuilderConfiguration
                    goBack={() => {
                        setCurrentPage('fromGitRepo');
                    }}
                    appName={`${getName()}-app`}
                    name={getName()}
                    gitURL={gitURL.url}
                    builderImage={getEffectiveBuilderImage()}

                />
            );
        case 'selectDifferentBuilderImage':
            return (
                <>
                    {!selectedBuilderImage ? (
                        <SelectBuilderImage
                            titleText="Select Different Builder Image"
                            goBack={() => {
                                setCurrentPage('fromGitRepo');
                            }}
                            setSelectedBuilderImage={setSelectedBuilderImage}
                            setBuilderImages={builderImages}
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
