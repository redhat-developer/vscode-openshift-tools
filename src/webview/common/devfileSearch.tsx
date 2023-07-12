/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Close, Launch, Search } from '@mui/icons-material';
import {
    Box,
    Button,
    Checkbox,
    Container,
    Divider,
    FormControl,
    FormControlLabel,
    FormGroup,
    FormHelperText,
    IconButton,
    InputAdornment,
    InputLabel,
    Link,
    MenuItem,
    Modal,
    Pagination,
    Paper,
    Select,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import * as React from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { monokai } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Devfile, DevfileRegistry, TemplateProjectIdentifier } from '../common/devfile';
import { DevfileExplanation } from './devfileExplanation';
import { DevfileListItem } from './devfileListItem';
import { LoadScreen } from './loading';

type Message = {
    action: string;
    data: any;
};

function LinkButton(props: { href: string; disabled: boolean; children }) {
    return (
        <Link href={props.disabled ? undefined : props.href} underline="none">
            <Button
                variant="text"
                onClick={(e) => {
                    e.preventDefault();
                }}
                endIcon={<Launch />}
                disabled={props.disabled}
            >
                {props.children}
            </Button>
        </Link>
    );
}

function SearchBar(props: {
    setSearchText: React.Dispatch<React.SetStateAction<string>>;
    numPages: number;
    currentPage: number;
    setCurrentPage: (i: number) => void;
}) {
    return (
        <Stack direction="row" alignItems="center">
            <TextField
                variant="filled"
                label="Search Devfiles"
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <Search />
                        </InputAdornment>
                    ),
                }}
                sx={{ flexGrow: '1' }}
                onChange={(event) => {
                    props.setSearchText(event.target.value.toLowerCase());
                }}
            />
            <Pagination
                count={props.numPages}
                page={props.currentPage}
                onChange={(_event, value: number) => {
                    props.setCurrentPage(value);
                }}
            />
        </Stack>
    );
}

function RegistriesPicker(props: {
    registryEnabled: { registryName: string; enabled: boolean }[];
    setRegistryEnabled: React.Dispatch<
        React.SetStateAction<{ registryName: string; enabled: boolean }[]>
    >;
}) {
    function onCheckboxClick(clickedRegistry: string, checked: boolean) {
        const updatedList = [...props.registryEnabled] //
            .filter((entry) => entry.registryName !== clickedRegistry);
        updatedList.push({
            registryName: clickedRegistry,
            enabled: checked,
        });
        props.setRegistryEnabled(updatedList);
    }

    return (
        <Stack direction="column" spacing={1} marginY={2}>
            <Typography variant="body2" marginBottom={1}>
                Devfile Registries
            </Typography>
            <FormGroup>
                {props.registryEnabled.map((registry) => {
                    return (
                        <FormControlLabel
                            control={
                                <Checkbox
                                    disabled={registry.registryName === 'DefaultDevfileRegistry'}
                                    checked={registry.enabled}
                                    onChange={(_e, checked) =>
                                        onCheckboxClick(registry.registryName, checked)
                                    }
                                />
                            }
                            label={registry.registryName}
                            key={registry.registryName}
                        />
                    );
                })}
            </FormGroup>
        </Stack>
    );
}

const SelectTemplateProject = React.forwardRef(
    (
        props: {
            devfile: Devfile;
            setSelectedProject: (projectName: string) => void;
            closeModal: () => void;
        },
        ref,
    ) => {
        const [selectedTemplateProject, setSelectedTemplateProject] = React.useState('');
        const [isInteracted, setInteracted] = React.useState(false);

        return (
            <Paper
                elevation={24}
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '900px',
                    transform: 'translate(-50%, -50%)',
                    padding: 2,
                }}
            >
                <Stack direction="column" spacing={3}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <DevfileListItem devfile={props.devfile} />
                        <IconButton onClick={props.closeModal}>
                            <Close />
                        </IconButton>
                    </Stack>
                    <FormControl fullWidth>
                        <InputLabel id="template-select-label">Template Project</InputLabel>
                        <Select
                            value={selectedTemplateProject}
                            onChange={(event) => {
                                setSelectedTemplateProject(event.target.value as string);
                            }}
                            onClick={(_e) => {
                                setInteracted(true);
                            }}
                            error={isInteracted && !selectedTemplateProject}
                            sx={{ flexGrow: '1' }}
                            label="Template Project"
                            labelId="template-select-label"
                        >
                            {props.devfile.starterProjects.map((sampleProject) => {
                                return (
                                    <MenuItem value={sampleProject.name} key={sampleProject.name}>
                                        {sampleProject.name}
                                    </MenuItem>
                                );
                            })}
                        </Select>
                        {isInteracted && !selectedTemplateProject && (
                            <FormHelperText>Select a template project</FormHelperText>
                        )}
                    </FormControl>
                    <Stack direction="row-reverse" spacing={2}>
                        <Button
                            variant="contained"
                            onClick={() => {
                                props.setSelectedProject(selectedTemplateProject);
                            }}
                            disabled={!selectedTemplateProject}
                        >
                            Next
                        </Button>
                        <LinkButton
                            href={
                                !selectedTemplateProject
                                    ? undefined
                                    : props.devfile.starterProjects.find(
                                          (starterProject) =>
                                              starterProject.name === selectedTemplateProject,
                                      ).git.remotes.origin
                            }
                            disabled={!selectedTemplateProject}
                        >
                            Open Project in Browser
                        </LinkButton>
                    </Stack>
                    <Box
                        maxHeight="400px"
                        width="100%"
                        overflow="scroll"
                        style={{ background: 'rgba(127, 127, 127, 8%)', borderRadius: '4px' }}
                    >
                        <SyntaxHighlighter
                            language="yaml"
                            style={monokai}
                            useInlineStyles
                            wrapLines
                            customStyle={{ background: 'inherit !important' }}
                            showLineNumbers
                            codeTagProps={{
                                style: {
                                    fontFamily: 'inherit',
                                    fontStyle: 'inherit',
                                    fontWeight: 'inherit',
                                },
                            }}
                        >
                            {props.devfile.yaml}
                        </SyntaxHighlighter>
                    </Box>
                </Stack>
            </Paper>
        );
    },
);

export type DevfileSearchProps = {
    titleText: string;

    /**
     * The callback to run when the user selects a Devfile.
     *
     * In order to avoid showing the template project selector,
     * write a callback that removes the DevfileSearch component from the page.
     */
    setSelectedDevfile?: (selected: Devfile) => void;

    /**
     * The callback to run when the user selects a template project.
     */
    setSelectedTemplateProject?: (selected: TemplateProjectIdentifier) => void;

    /**
     * The function to step backwards in the UI.
     */
    goBack: () => void;
};

export function DevfileSearch(props: DevfileSearchProps) {
    const ITEMS_PER_PAGE = 6;

    const [selectedDevfile, setSelectedDevfile] = React.useState<Devfile>();
    const [currentPage, setCurrentPage] = React.useState(1);
    const [devfileRegistries, setDevfileRegistries] = React.useState<DevfileRegistry[]>([]);
    const [registryEnabled, setRegistryEnabled] = React.useState<
        { registryName: string; enabled: boolean }[]
    >([]);
    const [searchText, setSearchText] = React.useState('');

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'devfileRegistries': {
                setDevfileRegistries((_devfileRegistries) => message.data);
            }
        }
    }

    React.useEffect(() => {
        const enabledArray = [];
        for (let registry of devfileRegistries) {
            enabledArray.push({
                registryName: registry.name,
                enabled: true,
            });
        }
        console.log('Ran "update registry enabled" effect');
        setRegistryEnabled((_) => enabledArray);
    }, [devfileRegistries.length]);

    React.useEffect(() => {
        props.setSelectedDevfile(selectedDevfile);
    }, [selectedDevfile]);

    React.useEffect(() => {
        window.addEventListener('message', respondToMessage);
        return () => {
            window.removeEventListener('message', respondToMessage);
        };
    }, []);

    React.useEffect(() => {
        window.vscodeApi.postMessage({ action: 'getDevfileRegistries' });
    }, []);

    React.useEffect(() => {
        setCurrentPage((_) => 1);
    }, [registryEnabled]);

    if (!devfileRegistries) {
        return <LoadScreen title="Retrieving list of Devfiles" />;
    }

    const activeRegistries = registryEnabled //
        .filter((entry) => entry.enabled) //
        .map((entry) => entry.registryName);
    const devfiles: Devfile[] = devfileRegistries //
        .filter((devfileRegistry) => activeRegistries.includes(devfileRegistry.name)) //
        .flatMap((devfileRegistry) => devfileRegistry.devfiles) //
        .filter((devfile) => {
            return (
                devfile.name.toLowerCase().includes(searchText) ||
                devfile.tags.find((tag) => tag.toLowerCase().includes(searchText))
            );
        });
    devfiles.sort((a, b) => (a.name < b.name ? -1 : 1));

    return (
        <>
            <Container sx={{ height: '100%', paddingY: '16px' }}>
                <Stack direction="column" height="100%" spacing={3}>
                    <Typography variant="h5" alignSelf="center">
                        {props.titleText}
                    </Typography>
                    <Stack direction="row" flexGrow="1" spacing={2}>
                        <RegistriesPicker
                            registryEnabled={registryEnabled}
                            setRegistryEnabled={setRegistryEnabled}
                        />
                        <Divider orientation="vertical" />
                        <Stack
                            direction="column"
                            sx={{ flexGrow: '1', height: '100%' }}
                            spacing={3}
                        >
                            <SearchBar
                                setSearchText={setSearchText}
                                currentPage={currentPage}
                                setCurrentPage={setCurrentPage}
                                numPages={
                                    Math.floor(devfiles.length / ITEMS_PER_PAGE) +
                                    (devfiles.length % ITEMS_PER_PAGE > 0.0001 ? 1 : 0)
                                }
                            />
                            {/* 320px is the approximate combined of the top bar and bottom bar in the devfile search view */}
                            <Stack
                                direction="column"
                                sx={{ height: 'calc(100vh - 320px)', overflow: 'scroll' }}
                                spacing={2}
                            >
                                {devfiles
                                    .slice(
                                        (currentPage - 1) * ITEMS_PER_PAGE,
                                        Math.min(currentPage * ITEMS_PER_PAGE, devfiles.length),
                                    )
                                    .map((devfile) => {
                                        return (
                                            <>
                                                <DevfileListItem
                                                    key={devfile.name}
                                                    devfile={devfile}
                                                    buttonCallback={() => {
                                                        setSelectedDevfile(devfile);
                                                    }}
                                                />
                                                <Divider key={`${devfile.name}-divider`} />
                                            </>
                                        );
                                    })}
                            </Stack>
                            <Typography align="center" flexGrow="1">
                                Showing items {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                                {Math.min(currentPage * ITEMS_PER_PAGE, devfiles.length)} of{' '}
                                {devfiles.length}
                            </Typography>
                        </Stack>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Button
                            variant="text"
                            onClick={(_) => {
                                props.goBack();
                            }}
                        >
                            Back
                        </Button>
                        <DevfileExplanation />
                    </Stack>
                </Stack>
            </Container>
            <Modal
                onClose={() => {
                    setSelectedDevfile(undefined);
                }}
                open={!!selectedDevfile}
            >
                <SelectTemplateProject
                    devfile={selectedDevfile}
                    setSelectedProject={(projectName) => {
                        if (!selectedDevfile) {
                            return;
                        }
                        props.setSelectedTemplateProject({
                            devfileId: selectedDevfile.id,
                            registryName: selectedDevfile.registryName,
                            templateProjectName: projectName,
                        });
                    }}
                    closeModal={() => {
                        setSelectedDevfile((_) => undefined);
                    }}
                />
            </Modal>
        </>
    );
}
