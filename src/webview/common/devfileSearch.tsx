/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Search } from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Container,
    Divider,
    FormControl,
    FormControlLabel,
    FormGroup,
    InputAdornment,
    InputLabel,
    MenuItem,
    Modal,
    Pagination,
    Paper,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import * as React from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { monokai } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Devfile, DevfileRegistry } from '../common/devfile';
import { DevfileExplanation } from './devfileExplanation';
import { DevfileListItem } from './devfileListItem';

type Message = {
    action: string;
    data: any;
}

function SearchBar(props: {
    setSearchText: React.Dispatch<React.SetStateAction<string>>
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
                onChange={(event) => { props.setSearchText(event.target.value.toLowerCase()) }}
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

function RegistriesPicker(props: { registryEnabled: { registryName: string, enabled: boolean }[], setRegistryEnabled: React.Dispatch<React.SetStateAction<{ registryName: string, enabled: boolean }[]>> }) {

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
                                    onChange={(_e, checked) => onCheckboxClick(registry.registryName, checked)}
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

const SelectTemplateProject = React.forwardRef((props: {
    devfile: Devfile;
    setSelectedProject: (projectName: string) => void;
}, ref) => {
    const [selectedTemplateProject, setSelectedTemplateProject] = React.useState('');
    const [isInteracted, setInteracted] = React.useState(false);

    return (
        <Paper
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
                <DevfileListItem devfile={props.devfile} />
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
                        {props.devfile.sampleProjects.map((sampleProject) => {
                            return (
                                <MenuItem value={sampleProject} key={sampleProject}>
                                    {sampleProject}
                                </MenuItem>
                            );
                        })}
                    </Select>
                </FormControl>
                {selectedTemplateProject ? (
                    <Button
                        variant="outlined"
                        onClick={() => {
                            props.setSelectedProject(selectedTemplateProject);
                        }}
                        style={{ alignSelf: 'flex-end' }}
                    >
                        Next
                    </Button>
                ) : (
                    <Alert severity="error" style={{ alignSelf: 'flex-end' }}>
                        Select a template project
                    </Alert>
                )}
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
});

export type DevfileSearchProps = {
    titleText: string;
    isTemplateSearch: boolean;
    setSelected?: ((devfile: string) => void) | ((templateProject: string) => void);
    setCurrentView: any;
};

export function DevfileSearch(props: DevfileSearchProps) {
    const ITEMS_PER_PAGE = 6;

    const [selectedDevfile, setSelectedDevfile] = React.useState('');
    const [currentPage, setCurrentPage] = React.useState(1);
    const [devfileRegistries, setDevfileRegistries] = React.useState<DevfileRegistry[]>([]);
    const [registryEnabled, setRegistryEnabled] = React.useState<{registryName: string, enabled: boolean}[]>([]);
    const [searchText, setSearchText] = React.useState('');

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'devfileRegistries': {
                setDevfileRegistries(_devfileRegistries => message.data);
            }
        }
    }

    React.useEffect(() => {
        const enabledArray = [];
        for (let registry of devfileRegistries) {
            enabledArray.push({
                registryName: registry.name,
                enabled: true,
            })
        }
        console.log('Ran "update registry enabled" effect');
        setRegistryEnabled((_) => enabledArray);
    }, [devfileRegistries.length]);

    React.useEffect(() => {
        window.addEventListener('message', respondToMessage);
        return () => {
            window.removeEventListener('message', respondToMessage);
        };
    }, []);

    React.useEffect(() => {
        window.vscodeApi.postMessage({ action: 'getDevfileRegistries' });
    }, [])

    if (!devfileRegistries) {
        return <CircularProgress />;
    }

    const activeRegistries = registryEnabled //
            .filter(entry => entry.enabled) //
            .map(entry => entry.registryName);
    const devfiles: Devfile[] = devfileRegistries //
            .filter((devfileRegistry) => activeRegistries.includes(devfileRegistry.name)) //
            .flatMap((devfileRegistry) => devfileRegistry.devfiles) //
            .filter((devfile) => {
                return devfile.name.toLowerCase().includes(searchText)
                || devfile.tags.find((tag) => tag.toLowerCase().includes(searchText));
            });
    devfiles.sort((a, b) => a.name < b.name ? -1 : 1);

    return (
        <>
            <Container sx={{ height: '100%', paddingY: '16px' }}>
                <Stack direction="column" height="100%" spacing={3}>
                    <Typography variant="h4" alignSelf="center">
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
                                numPages={Math.floor(devfiles.length / ITEMS_PER_PAGE) + (devfiles.length % ITEMS_PER_PAGE > 0.0001 ? 1 : 0)}
                            />
                            <Stack direction="column" sx={{ flexGrow: '1' }} spacing={2}>
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
                                                        if (props.isTemplateSearch) {
                                                            setSelectedDevfile(devfile.name);
                                                        } else {
                                                            props.setSelected(devfile.name);
                                                        }
                                                    }}
                                                />
                                                <Divider key={`${devfile.name}-divider`} />
                                            </>
                                        );
                                    })}
                            </Stack>
                            <Box flexGrow="1"></Box>
                            <Typography align="center">
                                Showing items {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                                {Math.min(currentPage * ITEMS_PER_PAGE, devfiles.length)}
                                {' '}of {devfiles.length}
                            </Typography>
                        </Stack>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Button variant="outlined" onClick={() => {props.setCurrentView('home')}}>Back</Button>
                        <DevfileExplanation />
                    </Stack>
                </Stack>
            </Container>
            <Modal
                onClose={() => {
                    setSelectedDevfile('');
                }}
                open={!!selectedDevfile}
            >
                <SelectTemplateProject
                    devfile={devfiles.find((devfile) => devfile.name === selectedDevfile)}
                    setSelectedProject={props.setSelected}
                />
            </Modal>
        </>
    );
}
