import { Search } from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Checkbox,
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
    Typography
} from '@mui/material';
import * as React from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { monokai } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { DevfileExplanation } from './devfileExplanation';
import { Devfile, DevfileListItem } from './devfileListItem';

function SearchBar(props: {
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

function RegistriesPicker(props: { registries: string[] }) {
    const [registryEnabled, setRegistryEnabled] = React.useState(() => {
        const enabled = new Map();
        for (let registry of props.registries) {
            enabled.set(registry, true);
        }
        return enabled;
    });

    function onCheckboxClick(registry) {
        return function (_e: never, checked: boolean) {
            setRegistryEnabled((currentRegistryEnabled) => {
                const newMap = new Map(currentRegistryEnabled);
                newMap.set(registry, checked);
                return newMap;
            });
        };
    }

    return (
        <Stack direction="column" spacing={1} marginY={2}>
            <Typography variant="body2" marginBottom={1}>Devfile Registries</Typography>
            <FormGroup>
                {props.registries.map((registry) => {
                    return (
                        <FormControlLabel
                            control={
                                <Checkbox
                                    disabled={registry === 'DefaultDevfileRegistry'}
                                    checked={registryEnabled.get(registry)}
                                    onChange={onCheckboxClick(registry)}
                                />
                            }
                            label={registry}
                            key={registry}
                        />
                    );
                })}
            </FormGroup>
        </Stack>
    );
}

function SelectTemplateProject(props: {
    devfile: Devfile;
    setSelectedProject: (projectName: string) => void;
}) {
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
}

export type DevfileSearchProps = {
    titleText: string;
    isTemplateSearch: boolean;
    setSelected?: ((devfile: string) => void) | ((templateProject: string) => void);
};

export function DevfileSearch(props: DevfileSearchProps) {
    const ITEMS_PER_PAGE = 6;

    const [selectedDevfile, setSelectedDevfile] = React.useState('');
    const [currentPage, setCurrentPage] = React.useState(1);

    const dummyDevfile: Devfile = {
        name: 'Go Runtime',
        description:
            'Go (version 1.18.x) is an open source programming language that makes it easy to build simple, reliable, and efficient software. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.',
        supportsDebug: true,
        supportsDeploy: false,
        tags: ['Go', 'Hugo'],
        logoUrl:
            'https://raw.githubusercontent.com/devfile-samples/devfile-stack-icons/main/golang.svg',
        sampleProjects: ['hugo-sample', 'go-backend-sample'],
        yaml: `schemaVersion: 2.1.0
metadata:
  name: go
  displayName: Go Runtime
  description: Go (version 1.18.x) is an open source programming language that makes it easy to build simple, reliable, and efficient software.
  icon: https://raw.githubusercontent.com/devfile-samples/devfile-stack-icons/main/golang.svg
  tags:
    - Go
  projectType: Go
  language: Go
  provider: Red Hat
  version: 1.0.2
starterProjects:
  - name: go-starter
    description: A Go project with a simple HTTP server
    git:
      checkoutFrom:
        revision: main
      remotes:
        origin: https://github.com/devfile-samples/devfile-stack-go.git
components:
  - container:
      endpoints:
        - name: http-go
          targetPort: 8080
      image: registry.access.redhat.com/ubi9/go-toolset:1.18.10-4
      args: ["tail", "-f", "/dev/null"]
      memoryLimit: 1024Mi
      mountSources: true
    name: runtime
commands:
  - exec:
      env:
        - name: GOPATH
          value: \${PROJECT_SOURCE}/.go
        - name: GOCACHE
          value: \${PROJECT_SOURCE}/.cache
      commandLine: go build main.go
      component: runtime
      group:
        isDefault: true
        kind: build
      workingDir: \${PROJECT_SOURCE}
    id: build
  - exec:
      commandLine: ./main
      component: runtime
      group:
        isDefault: true
        kind: run
      workingDir: \${PROJECT_SOURCE}
    id: run
        `,
    };

    const [devfiles, _setDevfiles] = React.useState<Devfile[]>([
        dummyDevfile,
        dummyDevfile,
        dummyDevfile,
        dummyDevfile,
        dummyDevfile,
        dummyDevfile,
        dummyDevfile,
        dummyDevfile,
        dummyDevfile,
        dummyDevfile,
        dummyDevfile,
        dummyDevfile,
        dummyDevfile,
        dummyDevfile,
    ]);

    return (
        <>
            <Container sx={{ height: '100%', paddingY: '16px' }}>
                <Stack direction="column" height="100%" spacing={3}>
                    <Typography variant="h4" alignSelf="center">
                        {props.titleText}
                    </Typography>
                    <Stack direction="row" flexGrow="1" spacing={2}>
                        <RegistriesPicker
                            registries={['DefaultDevfileRegistry', 'MyCustomRegistry']}
                        />
                        <Divider orientation="vertical" />
                        <Stack
                            direction="column"
                            sx={{ flexGrow: '1', height: '100%' }}
                            spacing={3}
                        >
                            <SearchBar
                                currentPage={currentPage}
                                setCurrentPage={setCurrentPage}
                                numPages={Math.floor(devfiles.length / ITEMS_PER_PAGE) + 1}
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
                                                <Divider />
                                            </>
                                        );
                                    })}
                            </Stack>
                            <Box flexGrow='1'></Box>
                            <Typography align='center'>Showing items {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, devfiles.length)}</Typography>
                        </Stack>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Button variant="outlined">Back</Button>
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
