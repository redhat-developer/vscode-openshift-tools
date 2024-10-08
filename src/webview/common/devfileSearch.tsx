/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { yaml } from '@codemirror/lang-yaml';
import { Close, FileCopy, Launch, Search } from '@mui/icons-material';
import {
    Box,
    Button,
    Checkbox,
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
    Theme,
    Tooltip,
    Typography,
    useMediaQuery
} from '@mui/material';
import CodeMirror from '@uiw/react-codemirror';
import { every } from 'lodash';
import * as React from 'react';
import CopyToClipboard from 'react-copy-to-clipboard';
import { DevfileData, DevfileInfo, DevfileRegistryInfo } from '../../devfile-registry/devfileInfo';
import { TemplateProjectIdentifier } from '../common/devfile';
import { DevfileExplanation } from './devfileExplanation';
import { DevfileListItem } from './devfileListItem';
import { ErrorPage } from './errorPage';
import { LoadScreen } from './loading';
import { vsDarkCodeMirrorTheme, vsLightCodeMirrorTheme } from './vscode-theme';

// in order to add custom named colours for use in Material UI's `color` prop,
// you need to use module augmentation.
// see https://mui.com/material-ui/customization/palette/#typescript
declare module '@mui/material/SvgIcon' {
    interface SvgIconPropsColorOverrides {
        textSecondary: true;
    }
}

type Message = {
    action: string;
    data: any;
};

const QUARKUS_REGEX = /[Qq]uarkus/;

function LinkButton(props: { href: string; disabled: boolean; onClick: () => void; children }) {
    return (
        <Link href={props.disabled ? undefined : props.href} underline="none">
            <Button
                variant="text"
                onClick={(e) => {
                    if (props.onClick) {
                        props.onClick();
                    }
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
    searchText: string;
    setSearchText: React.Dispatch<React.SetStateAction<string>>;
    numPages: number;
    currentPage: number;
    setCurrentPage: (i: number) => void;
    perPageCount: number;
    devfilesLength: number;
}) {
    return (
        <Stack direction="row" alignItems="center" width="100%" justifyContent="space-between">
            <TextField
                variant="outlined"
                placeholder='Search'
                margin='normal'
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start" sx={{ marginTop: '0px !important' }}>
                            <Search color="textSecondary" fontSize='small' />
                        </InputAdornment>
                    ),
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton onClick={() => props.setSearchText('')}>
                                <Close color="textSecondary" fontSize='small' />
                            </IconButton>
                        </InputAdornment>
                    ),
                    disableUnderline: true
                }}
                value={props.searchText}
                sx={{ flexGrow: '1', maxWidth: '650px', py: 0, background: 'rgba(127, 127, 127, 8%)' }}
                onChange={(event) => {
                    props.setSearchText(event.target.value.toLowerCase());
                }}
            />
            <Stack direction="column" justifyContent="space-between" marginTop={0.5} gap={0.5}>
                <Pagination
                    count={props.numPages}
                    page={props.currentPage}
                    onChange={(_event, value: number) => {
                        props.setCurrentPage(value);
                    }}
                />
                <Typography align="center" flexGrow="1">
                    Showing items { props.numPages > 0 ? (props.currentPage - 1) * props.perPageCount + 1 : 0} -{' '}
                    {Math.min(props.currentPage * props.perPageCount, props.devfilesLength)} of{' '}
                    {props.devfilesLength}
                </Typography>
            </Stack>
        </Stack>
    );
}

function RegistriesPicker(props: {
    registryEnabled: { registryName: string; registryUrl: string; enabled: boolean }[];
    setRegistryEnabled: React.Dispatch<
        React.SetStateAction<{ registryName: string; registryUrl: string; enabled: boolean }[]>
    >;
}) {
    function onCheckboxClick(clickedRegistry: string, checked: boolean) {
        const prevVal = props.registryEnabled.find(
            (entry) => entry.registryName === clickedRegistry,
        );
        const updatedList = [...props.registryEnabled] //
            .filter((entry) => entry.registryName !== clickedRegistry);
        updatedList.push({
            registryName: clickedRegistry,
            registryUrl: prevVal.registryUrl,
            enabled: checked,
        });
        updatedList.sort((regA, regB) => regA.registryName.localeCompare(regB.registryName));
        props.setRegistryEnabled(updatedList);
    }

    return (
        <FormGroup>
            {props.registryEnabled.map((registry) => {
                return (
                    <FormControlLabel
                        control={
                            <Checkbox
                                size='small'
                                disabled={
                                    registry.registryUrl === 'https://registry.devfile.io'
                                }
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
    );
}

/**
 * sort the tags based on selection and alphabet order.
 *
 * @param oldTag the first tag to compare
 * @param newTag the second tag to compare
 * @returns a negative number if the first tag should go first, and a positive number if the second tag should go first
 */
function ascTag(oldTag: { name: string; enabled: boolean }, newTag: { name: string; enabled: boolean }) {

    //Priority order Quarkus, Java, Node.js and Python
    const javaPriorites = ['Java', 'Maven'];
    const nodeJsPriorities = ['Node.js', 'Next.js', 'Express'];
    const pythonPriorities = ['Python', 'Django', 'Pip'];

    const aQuarkus = QUARKUS_REGEX.test(oldTag.name);
    const bQuarkus = QUARKUS_REGEX.test(newTag.name);

    if (aQuarkus && !bQuarkus) {
        return -1;
    } else if (bQuarkus && !aQuarkus) {
        return 1;
    } else if (javaPriorites.includes(oldTag.name) && !javaPriorites.includes(newTag.name)) {
        return -1;
    } else if (!javaPriorites.includes(oldTag.name) && javaPriorites.includes(newTag.name)) {
        return 1;
    } else if (nodeJsPriorities.includes(oldTag.name) && !nodeJsPriorities.includes(newTag.name)) {
        return -1;
    } else if (!nodeJsPriorities.includes(oldTag.name) && nodeJsPriorities.includes(newTag.name)) {
        return 1;
    } else if (pythonPriorities.includes(oldTag.name) && !pythonPriorities.includes(newTag.name)) {
        return -1;
    } else if (!pythonPriorities.includes(oldTag.name) && pythonPriorities.includes(newTag.name)) {
        return 1;
    }
    return oldTag.name.localeCompare(newTag.name);
}

function TagsPicker(props: {
    tagEnabled: { name: string; enabled: boolean }[];
    setTagEnabled: React.Dispatch<
        React.SetStateAction<{ name: string; enabled: boolean }[]>
    >;
}) {
    function onCheckboxClick(clickedRegistry: string, checked: boolean) {
        const updatedList = [...props.tagEnabled] //
            .filter((entry) => entry.name !== clickedRegistry);
        updatedList.push({
            name: clickedRegistry,
            enabled: checked,
        });
        updatedList.sort(ascTag);
        props.setTagEnabled(updatedList);
    }

    return (
        <FormGroup>
            {props.tagEnabled.map((tag) => {
                return (
                    <FormControlLabel
                        control={
                            <Checkbox
                                size='small'
                                checked={tag.enabled}
                                onChange={(_e, checked) =>
                                    onCheckboxClick(tag.name, checked)
                                }
                            />
                        }
                        label={tag.name}
                        key={tag.name}
                    />
                );
            })}
        </FormGroup>
    );
}

const SelectTemplateProject = React.forwardRef(
    (
        props: {
            devfileInfo: DevfileInfo;
            selectedDevfileVersion?: string;
            setSelectedDevfile: (selected: DevfileData) => void;
            setSelectedProject: (projectName: string) => void;
            closeModal: () => void;
            theme: Theme;
        }
    ) => {
        const [isSomeDevfileRetrieved, setSomeDevfileRetrieved] = React.useState(false);
        const [selectedDevfileVersion, setSelectedDevfileVersion] = React.useState<string>(undefined);
        const [selectedDevfile, setSelectedDevfile] = React.useState<DevfileData>(undefined);
        const [selectedTemplateProject, setSelectedTemplateProject] = React.useState('');
        const [isInteracted, setInteracted] = React.useState(false);
        const [isYamlCopied, setYamlCopied] = React.useState(false);

        function respondToMessage(messageEvent: MessageEvent) {
            const message = messageEvent.data as Message;
            switch (message.action) {
                case 'devfile': {
                    if (message.data) {
                        const devfile = message.data;
                        setSelectedDevfileVersion((_version) => devfile.metadata?.version);
                        setSelectedDevfile((_devfile) => devfile);
                        setSomeDevfileRetrieved(_unused => true);
                    }
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

        React.useEffect(() => {
            window.vscodeApi.postMessage(
                {
                    action: 'getDevfile',
                    data: {
                        devfileInfo: props.devfileInfo,
                        version: selectedDevfileVersion
                    }
                });
        }, []);

        React.useEffect(() => {
            if (selectedDevfile) {
                if (selectedDevfile.starterProjects && selectedDevfile.starterProjects.length > 0) {
                    setSelectedTemplateProject((_) => selectedDevfile.starterProjects[0].name);
                }
            }
        }, [selectedDevfile]);

        const starterProjects = selectedDevfile?.starterProjects ? selectedDevfile.starterProjects : [];
        let helperText = '';
        switch (starterProjects.length) {
            case 0:
                helperText = 'No available starter projects for this Devfile';
                break;
            case 1:
                helperText = 'Only one starter project is available for this Devfile';
                break;
            default:
                if (isInteracted && !selectedTemplateProject) {
                    helperText = 'Select a template project';
                }
                break;
        }

        const versions = props.devfileInfo.versions ? props.devfileInfo.versions : [];
        const initialSelectedVersion = selectedDevfileVersion
                || props.devfileInfo.versions.filter((versionInfo) => versionInfo.default).pop()?.version
                || props.devfileInfo.versions.pop()?.version;
        if (!selectedDevfileVersion) {
            setSelectedDevfileVersion(initialSelectedVersion);
        }

        let versionHelperText = '';
        switch (versions.length) {
            case 0:
                versionHelperText = 'No available versions';
                break;
            case 1:
                versionHelperText = 'Only one version is available for the Devfile';
                break;
            default:
                if (isInteracted && !selectedDevfileVersion) {
                    versionHelperText = 'Select a version';
                }
                break;
        }

        const projectUrl = React.useMemo(() => {
            if (!selectedTemplateProject) {
                return undefined;
            }
            const fullSelectedTemplateProject = starterProjects.find(
                (starterProject) => starterProject.name === selectedTemplateProject,
            );
            if (fullSelectedTemplateProject.git) {
                if (fullSelectedTemplateProject.git.checkoutFrom?.remote) {
                    const remote = fullSelectedTemplateProject.git.checkoutFrom.remote;
                    return fullSelectedTemplateProject.git.remotes[remote];
                }
                return fullSelectedTemplateProject.git.remotes.origin;
            } else if (fullSelectedTemplateProject.zip) {
                return fullSelectedTemplateProject.zip.location;
            }
            return undefined;
        }, [selectedDevfile, selectedTemplateProject]);

        const isWideEnough = useMediaQuery('(min-width: 900px)');

        const isVersionError = !props.devfileInfo.versions?.length || (isInteracted && !selectedDevfileVersion);

        const isError = !starterProjects.length || (isInteracted && !selectedTemplateProject);

        return (
            <Paper
                elevation={24}
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: isWideEnough ? '900px' : 'calc(100vw - 48px)',
                    maxHeight: '100vh',
                    transform: 'translate(-50%, -50%)',
                    padding: 2,
                }}
            >
                {
                    !isSomeDevfileRetrieved ?
                    <Stack direction="column" spacing={2}>
                        <LoadScreen title='Retrieving the Devfile...' />
                    </Stack>
                    :
                    <Stack direction="column" spacing={2}>
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="flex-start"
                            marginBottom={1}
                        >
                            <DevfileListItem
                                devfileInfo={props.devfileInfo}
                                devfile={selectedDevfile}
                                showFullDescription
                            />
                            <IconButton onClick={props.closeModal}>
                                <Close color="textSecondary" fontSize='small' />
                            </IconButton>
                        </Stack>
                        <FormControl fullWidth>
                            <Stack direction="row" justifyContent="space-between">
                                <InputLabel id='version-select-label'>Version</InputLabel>
                                <Select
                                    value={initialSelectedVersion}
                                    onChange={(event) => {
                                        const devfileVersion = props.devfileInfo.versions.filter((versionInfo) => versionInfo.version === event.target.value).pop();
                                        if (selectedDevfileVersion !== event.target.value) {
                                            setSelectedDevfileVersion(devfileVersion.version);
                                            window.vscodeApi.postMessage(
                                            {
                                                action: 'getDevfile',
                                                data: {
                                                    devfileInfo: props.devfileInfo,
                                                    version: devfileVersion.version
                                                }
                                            });
                                        }
                                    }}
                                    onClick={(_e) => {
                                        setInteracted(true);
                                    }}
                                    disabled={!props.devfileInfo.versions || props.devfileInfo.versions.length < 2}
                                    error={isVersionError}
                                    sx={{ flexGrow: '1' }}
                                    label='Versions'
                                    labelId='version-select-label'
                                >
                                    {props.devfileInfo.versions.map((versionInfo) => {
                                        return (
                                            <MenuItem value={versionInfo.version} key={versionInfo.version}>
                                                {versionInfo.version}
                                            </MenuItem>
                                        );
                                    })}
                                </Select>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                                <FormHelperText error={isVersionError}>{versionHelperText}</FormHelperText>
                            </Stack>
                        </FormControl>
                        <FormControl fullWidth>
                            <Stack direction="row" justifyContent="space-between">
                                <InputLabel id="template-select-label">Template Project</InputLabel>
                                <Select
                                    value={selectedTemplateProject}
                                    onChange={(event) => {
                                        setSelectedTemplateProject(event.target.value);
                                    }}
                                    onClick={(_e) => {
                                        setInteracted(true);
                                    }}
                                    disabled={starterProjects.length < 2}
                                    error={isError}
                                    sx={{ flexGrow: '1' }}
                                    label="Template Project"
                                    labelId="template-select-label"
                                >
                                    {starterProjects.map((sampleProject) => {
                                        return (
                                            <MenuItem value={sampleProject.name} key={sampleProject.name}>
                                                {sampleProject.name}
                                            </MenuItem>
                                        );
                                    })}
                                </Select>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                                <FormHelperText error={isError}>{helperText}</FormHelperText>
                                <Stack direction="row" marginTop={1} spacing={2}>
                                    <LinkButton
                                        href={projectUrl}
                                        disabled={!projectUrl}
                                        onClick={() => {
                                            window.vscodeApi.postMessage({
                                                action: 'sendTelemetry',
                                                data: {
                                                    actionName: 'devfileSearchOpenProjectInBrowser',
                                                    properties: {
                                                        // eslint-disable-next-line camelcase
                                                        component_type: props.devfileInfo.name,
                                                        // eslint-disable-next-line camelcase
                                                        starter_project: selectedTemplateProject,
                                                    },
                                                },
                                            });
                                        }}
                                    >
                                        Open Project in Browser
                                    </LinkButton>
                                    <Button
                                        variant="contained"
                                        onClick={() => {
                                            props.setSelectedDevfile(selectedDevfile);
                                            props.setSelectedProject(selectedTemplateProject);
                                        }}
                                        disabled={!selectedTemplateProject}
                                    >
                                        Use Devfile
                                    </Button>
                                </Stack>
                            </Stack>
                        </FormControl>
                        <Box justifyContent='space-between'>
                            <Box paddingTop={1} style={{ float: 'right' }}>
                                <CopyToClipboard
                                    text={selectedDevfile.yaml}
                                    onCopy={() => {
                                        window.vscodeApi.postMessage({
                                            action: 'sendTelemetry',
                                            data: {
                                                actionName: 'devfileSearchCopiedYaml',
                                                properties: {
                                                    // eslint-disable-next-line camelcase
                                                    component_type: props.devfileInfo.name,
                                                    // eslint-disable-next-line camelcase
                                                    starter_project: selectedTemplateProject,
                                                },
                                            },
                                        });
                                        setYamlCopied((_) => true);
                                    }}
                                >
                                    <Tooltip
                                        title={isYamlCopied ? 'Copied!' : 'Copy YAML'}
                                        onMouseLeave={() => {
                                            setTimeout(() => setYamlCopied((_) => false), 200);
                                        }}
                                        arrow
                                    >
                                        <IconButton>
                                            <FileCopy color="textSecondary" />
                                        </IconButton>
                                    </Tooltip>
                                </CopyToClipboard>
                            </Box>
                            <CodeMirror
                                value={selectedDevfile.yaml}
                                height='400px'
                                width='fullWidth'
                                extensions={[yaml()]}
                                readOnly
                                theme={props.theme?.palette.mode === 'light' ? vsLightCodeMirrorTheme : vsDarkCodeMirrorTheme}
                                basicSetup={{
                                    lineNumbers: true,
                                    highlightActiveLine: true,
                                    syntaxHighlighting: true
                                }} />
                        </Box>
                    </Stack>
                }
            </Paper>
        );
    },
);

export type DevfileSearchProps = {
    titleText: string;

    /**
     * The callback to run when the user selects a DevfileInfo.
     *
     * In order to avoid showing the template project selector,
     * write a callback that removes the DevfileSearch component from the page.
     */
    setSelectedDevfileInfo?: (selected: DevfileInfo) => void;

    /**
     * The callback to run when the user selects a Devfile.
     *
     * In order to avoid showing the template project selector,
     * write a callback that removes the DevfileSearch component from the page.
     */
    setSelectedDevfile?: (selected: DevfileData) => void;

    /**
     * The callback to run when the user selects a template project.
     */
    setSelectedTemplateProject?: (selected: TemplateProjectIdentifier) => void;

    /**
     * The function to step backwards in the UI.
     */
    goBack?: () => void;

    theme?: Theme;
};

/**
 * Calculates if specified devfile is to be included into search results
 * based on devfile tags and tags filter. A devfile is to be included if:
 * - it contains any of selected tags
 * - always if there is no any selected tags
 *
 * @returns true if the specified Devfile should be included in the search results, and false otherwise
 */
function isToBeIncluded(devfileInfo: DevfileInfo, tagFilter: string[], debugSupportFilter: boolean, deploySupportFilter: boolean): boolean {
    const includesDebugSupport = debugSupportFilter === false ||
            devfileInfo.versions.some((version) => version.commandGroups.debug === debugSupportFilter);
    const includesDeploySupport = deploySupportFilter === false ||
            devfileInfo.versions.some((version) => version.commandGroups.deploy === deploySupportFilter);
    const includesTags = tagFilter.length === 0 || devfileInfo.tags.filter((_devfileTag) => {
        return tagFilter.find((_selectedTags) => _devfileTag === _selectedTags) !== undefined;
    }).length > 0;

    return includesDebugSupport && includesDeploySupport && includesTags;
}

function getDefaultDevfileVersion(devfileInfo: DevfileInfo): string {
    return devfileInfo.versions.find((_versionInfo) => _versionInfo.default)?.version || 'latest';
}

export function DevfileSearch(props: DevfileSearchProps) {
    const ITEMS_PER_PAGE = 12;

    const [isSomeDevfileInfoRetrieved, setSomeDevfileInfoRetrieved] = React.useState(false);
    const [selectedDevfileInfo, setSelectedDevfileInfo] = React.useState<DevfileInfo>();
    const [currentPage, setCurrentPage] = React.useState(1);
    const [devfileRegistries, setDevfileRegistries] = React.useState<DevfileRegistryInfo[]>([]);
    const [devfileInfos, setDevfileInfos] = React.useState<DevfileInfo[]>([]);
    const [registryEnabled, setRegistryEnabled] = React.useState<
        { registryName: string; registryUrl: string; enabled: boolean }[]
    >([]);
    const [devfileCapabilities, setDevfileCapabilities] = React.useState<string[]>([]);
    const [capabilityEnabled, setCapabilityEnabled] = React.useState<
        { name: string; enabled: boolean }[]
    >([]);
    const [devfileTags, setDevfileTags] = React.useState<string[]>([]);
    const [tagEnabled, setTagEnabled] = React.useState<
        { name: string; enabled: boolean }[]
    >([]);
    const [searchText, setSearchText] = React.useState('');

    const [showMore, setShowMore] = React.useState(false);
    const [createComponentErrorMessage, setCreateComponentErrorMessage] = React.useState('');

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'devfileRegistries': {
                setDevfileRegistries((_devfileRegistries) => message.data);
                setDevfileInfos((_devfileInfos) => []);
                setSelectedDevfileInfo((_unused) => undefined);
                setSomeDevfileInfoRetrieved(_unused => false);
                window.vscodeApi.postMessage({ action: 'getDevfileInfos' });
                break;
            }
            case 'devfileInfos': {
                setDevfileInfos((_devfileInfos) => message.data);
                setSomeDevfileInfoRetrieved(_unused => true);
                break;
            }
            case 'devfileCapabilities': {
                setDevfileCapabilities((_devfileCapabilities) => message.data);
                break;
            }
            case 'devfileTags': {
                setDevfileTags((_devfileTags) => message.data);
                break;
            }
            case 'createComponentFailed': {
                setSomeDevfileInfoRetrieved(_unused => true);
                setCreateComponentErrorMessage(message.data);
                break;
            }
            default:
                break;
        }
    }

    React.useEffect(() => {
        const enabledArray = [];
        for (const registry of devfileRegistries) {
            enabledArray.push({
                registryName: registry.name,
                registryUrl: registry.url,
                enabled: true,
            });
        }
        setRegistryEnabled((_) => enabledArray);
    }, [devfileRegistries]);

    React.useEffect(() => {
        const enabledArray = [];
        for (const capability of devfileCapabilities) {
            enabledArray.push({
                name: capability,
                enabled: false // All values set to false means that no filter is to be applied
            });
        }
        setCapabilityEnabled((_) => enabledArray);
    }, [devfileCapabilities]);

    const clearDevfileAll = () => {
        const enabledArray = [];
        for (const tag of devfileTags) {
            enabledArray.push({
                name: tag,
                enabled: false // All values set to false means that no filter is to be applied
            });
        }
        setTagEnabled((_) => enabledArray.sort(ascTag));
    }

    React.useEffect(() => clearDevfileAll(), [devfileTags]);

    React.useEffect(() => {
        if (props.setSelectedDevfileInfo) {
            props.setSelectedDevfileInfo(selectedDevfileInfo);
        }
    }, [selectedDevfileInfo]);

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
        window.vscodeApi.postMessage({ action: 'getDevfileInfos' });
    }, []);

    React.useEffect(() => {
        window.vscodeApi.postMessage({ action: 'getDevfileCapabilities' });
    }, []);

    React.useEffect(() => {
        window.vscodeApi.postMessage({ action: 'getDevfileTags' });
    }, []);

    React.useEffect(() => {
        setCurrentPage((_) => 1);
    }, [registryEnabled, capabilityEnabled, tagEnabled, searchText]);

    if (!devfileInfos) {
        return <LoadScreen title="Retrieving list of Devfiles..." />;
    }

    if (!devfileCapabilities) {
        return <LoadScreen title="Retrieving list of Devfile Capabilities..." />;
    }

    if (!devfileTags) {
        return <LoadScreen title="Retrieving list of Devfile Tags..." />;
    }

    if (createComponentErrorMessage) {
        return (
            <>
                <Stack direction="column" height="100%" spacing={0.5}>
                    <ErrorPage
                        message={`${createComponentErrorMessage}`}
                    />
                </Stack>
            </>
        );
    }

    const activeRegistries = registryEnabled //
        .filter((entry) => entry.enabled) //
        .map((entry) => entry.registryName);

    const debugSupport = capabilityEnabled //
        .filter((_cap) => _cap.name === 'Debug') //
        .filter((_cap) => _cap.enabled) //
        .length > 0;

    const deploySupport = capabilityEnabled //
        .filter((_cap) => _cap.name === 'Deploy') //
        .filter((_cap) => _cap.enabled) //
        .length > 0;

    const activeTags = tagEnabled
        .filter((_tag) => _tag.enabled) //
        .map((_tag) => _tag.name);

    const devfiles: DevfileInfo[] = devfileInfos //
        .filter((devfileInfo) => activeRegistries.includes(devfileInfo.registry.name)) //
        .filter((devfileInfo) => isToBeIncluded(devfileInfo, activeTags, debugSupport, deploySupport)) //
        .filter((devfileInfo) => {
            const searchTerms = searchText.split(/\s+/);
            return every(
                searchTerms.map(
                    (searchTerm) =>
                        devfileInfo.name.toLowerCase().includes(searchTerm) ||
                        devfileInfo.tags.find((tag) => tag.toLowerCase().includes(searchTerm)),
                ),
            );
        });

    devfiles.sort((a, b) => {
        const aQuarkus = QUARKUS_REGEX.test(a.name);
        const bQuarkus = QUARKUS_REGEX.test(b.name);
        if (aQuarkus && !bQuarkus) {
            return -1;
        } else if (bQuarkus && !aQuarkus) {
            return 1;
        }

        const aSupportsDebug = a.versions.some((version) => version.commandGroups.debug === true);
        const bSupportsDebug = b.versions.some((version) => version.commandGroups.debug === true);

        if (aSupportsDebug && !bSupportsDebug) {
            return -1;
        } else if (bSupportsDebug && !aSupportsDebug) {
            return 1;
        }

        return a.displayName < b.displayName ? -1 : 1;
    });

    return (
        <>
            <Stack direction="column" height="100%" spacing={0.5}>
                {
                    !isSomeDevfileInfoRetrieved ?
                        <LoadScreen title='Retrieving Devfiles...' /> :
                        <Stack direction="row" spacing={1} width={'100%'}>
                            <Stack direction="column" maxWidth={'30%'} sx={{
                                height: 'calc(100vh - 100px)',
                                overflow: 'scroll'
                            }} spacing={0}>
                                <Typography variant="body2" marginBottom={1}>
                                    Filter by
                                </Typography>

                                {
                                    devfileRegistries.length > 1 && (
                                        <>
                                            <Typography variant="body2" marginTop={1} marginBottom={1}>
                                                Devfile Registries
                                            </Typography>
                                            <RegistriesPicker
                                                registryEnabled={registryEnabled}
                                                setRegistryEnabled={setRegistryEnabled}
                                            />
                                            <Divider orientation="horizontal" sx={{ width: '100%' }} />
                                        </>
                                    )
                                }

                                {
                                    devfileCapabilities.length > 0 && (
                                        <Stack direction="column" spacing={0}>
                                            <Typography variant="body2" marginBottom={1} marginTop={1}>
                                                Support
                                            </Typography>
                                            <Stack direction="column" useFlexGap={true} width="100%" spacing={1}>
                                                {
                                                    devfileCapabilities.length > 0 && (
                                                        <>
                                                            <TagsPicker
                                                                tagEnabled={capabilityEnabled}
                                                                setTagEnabled={setCapabilityEnabled} />
                                                            <Divider orientation="horizontal" sx={{ width: '100%' }} />
                                                        </>
                                                    )
                                                }
                                            </Stack>
                                        </Stack>
                                    )
                                }

                                {
                                    devfileTags.length > 0 && (
                                        <>
                                            <Stack id='tags' direction="column" sx={{
                                                height: !showMore ? '55vh' : 'calc(300vh - 150px)',
                                                overflow: !showMore ? 'hidden' : 'scroll'
                                            }} spacing={0}>
                                                <Typography variant="body2" marginTop={1} marginBottom={1}>
                                                    Tags
                                                </Typography>
                                                <TagsPicker
                                                    tagEnabled={tagEnabled}
                                                    setTagEnabled={setTagEnabled} />
                                            </Stack>
                                            <Stack direction='row' gap={2}>
                                                <Typography variant="body2" marginTop={1} marginBottom={1}>
                                                    <Link
                                                        component="button"
                                                        variant="body2"
                                                        underline='none'
                                                        sx={{ color: 'var(--vscode-button-foreground) !important' }}
                                                        onClick={() => {
                                                            setShowMore((prev) => !prev);
                                                            if (showMore) {
                                                                const myDiv = document.getElementById('tags');
                                                                myDiv.scrollTop = 0;
                                                            }
                                                        }}
                                                    >
                                                        Show {!showMore ? 'more' : 'less'}
                                                    </Link>
                                                </Typography>
                                                {
                                                    activeTags.length > 0 &&
                                                    <Typography variant="body2" marginTop={1} marginBottom={1}>
                                                        <Link
                                                            component="button"
                                                            color='error'
                                                            variant="body2"
                                                            underline='none'
                                                            onClick={() => {
                                                                clearDevfileAll()
                                                            }}
                                                        >
                                                            Clear {activeTags.length > 1 ? 'all' : ''}
                                                        </Link>
                                                    </Typography>
                                                }
                                            </Stack>
                                        </>
                                    )
                                }
                            </Stack>
                            <Divider orientation="vertical" sx={{ height: 'calc(100vh - 80px)' }} />

                            <Stack direction="column" sx={{ flexGrow: '1' }} spacing={1} width={'70%'}>
                                <SearchBar
                                    searchText={searchText}
                                    setSearchText={setSearchText}
                                    currentPage={currentPage}
                                    setCurrentPage={setCurrentPage}
                                    numPages={
                                        Math.floor(devfiles.length / ITEMS_PER_PAGE) +
                                        (devfiles.length % ITEMS_PER_PAGE > 0.0001 ? 1 : 0)
                                    }
                                    perPageCount={ITEMS_PER_PAGE}
                                    devfilesLength={devfiles.length}
                                />
                                {/* 320px is the approximate combined height of the top bar and bottom bar in the devfile search view */}
                                {/* 5em is the padding at the top of the page */}
                                <Stack
                                    id="devfileList"
                                    direction="column"
                                    sx={{ height: 'calc(100vh - 140px)', overflow: 'scroll' }}
                                    divider={<Divider />}
                                    width={'100%'}
                                >
                                    {devfiles
                                        .slice(
                                            (currentPage - 1) * ITEMS_PER_PAGE,
                                            Math.min(currentPage * ITEMS_PER_PAGE, devfiles.length),
                                        )
                                        .map((devfileInfo) => {
                                            return (
                                                <DevfileListItem
                                                    key={`${devfileInfo.registry.name}-${devfileInfo.name}`}
                                                    devfileInfo={devfileInfo}
                                                    devfile={undefined}
                                                    buttonCallback={() => {
                                                        setSelectedDevfileInfo(devfileInfo);
                                                    }}
                                                />
                                            );
                                        })}
                                </Stack>
                            </Stack>
                        </Stack>
                }
                <Stack direction="row-reverse" justifyContent="space-between" alignItems="center">
                    <DevfileExplanation />
                    {props.goBack && (
                        <Button
                            variant="outlined"
                            onClick={(_) => {
                                props.goBack();
                            }}
                        >
                            Back
                        </Button>
                    )}
                </Stack>
            </Stack>
            <Modal
                onClose={() => {
                    setSelectedDevfileInfo(undefined);
                }}
                open={!!selectedDevfileInfo}
                disableScrollLock
            >
                <SelectTemplateProject
                    devfileInfo={selectedDevfileInfo}
                    setSelectedProject={(projectName) => {
                        if (!selectedDevfileInfo) {
                            return;
                        }
                        if (props.setSelectedTemplateProject) {
                            props.setSelectedTemplateProject({
                                devfileId: selectedDevfileInfo.name,
                                devfileVersion: getDefaultDevfileVersion(selectedDevfileInfo),
                                registryName: selectedDevfileInfo.registry.name,
                                templateProjectName: projectName,
                            });
                        }
                    }}
                    setSelectedDevfile={(devfile) => {
                        if (props.setSelectedDevfile) {
                            props.setSelectedDevfile(devfile);
                        }
                    }}
                    closeModal={() => {
                        setSelectedDevfileInfo((_) => undefined);
                    }}
                    theme={props.theme}
                />
            </Modal>
        </>
    );
}
