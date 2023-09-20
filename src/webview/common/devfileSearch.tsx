/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Close, FileCopy, Launch, Search } from '@mui/icons-material';
import {
    Box,
    Button,
    Chip,
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
    Tooltip,
    Typography,
    useMediaQuery
} from '@mui/material';
import { every } from 'lodash';
import * as React from 'react';
import CopyToClipboard from 'react-copy-to-clipboard';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { monokai } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Devfile, DevfileRegistry, TemplateProjectIdentifier } from '../common/devfile';
import { DevfileExplanation } from './devfileExplanation';
import { DevfileListItem } from './devfileListItem';
import { LoadScreen } from './loading';

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
}) {
    return (
        <Stack direction="row" alignItems="center" width="100%" justifyContent="space-between">
            <TextField
                variant="filled"
                label="Search Devfiles"
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <Search color="textSecondary" />
                        </InputAdornment>
                    ),
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton onClick={() => props.setSearchText('')}>
                                <Close color="textSecondary" />
                            </IconButton>
                        </InputAdornment>
                    ),
                }}
                value={props.searchText}
                sx={{ flexGrow: '1', maxWidth: '450px' }}
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

function RegistryCapabilitiesPicker(props: {
    capabilityEnabled: { capabilityName: string; enabled: boolean }[];
    setCapabilityEnabled: React.Dispatch<
        React.SetStateAction<{ capabilityName: string; enabled: boolean }[]>
    >;
}) {
    function onClick(clickedCapability: string, checked: boolean) {
        const updatedList = [...props.capabilityEnabled] //
            .filter((entry) => entry.capabilityName !== clickedCapability);
        updatedList.push({
            capabilityName: clickedCapability,
            enabled: checked,
        });
        const filteredUpdatedList = updatedList
            .sort((capA, capB) => {
                return capA.capabilityName.localeCompare(capB.capabilityName)
            });
        props.setCapabilityEnabled([...filteredUpdatedList]);
    }

    return (
        <Stack spacing={1} useFlexGap direction='row' flexWrap='wrap'>
            {props.capabilityEnabled.map((_cap) => {
                return (
                    <Chip
                        size="small"
                        sx={{ borderSpacing: '3', margin:'1' }}
                        clickable={true}
                        color={_cap.enabled ? 'success':'default'}
                        onClick={(_) => {onClick(_cap.capabilityName, !_cap.enabled)}}
                        label={_cap.capabilityName}
                        key={_cap.capabilityName}
                    />
                );
            })}
        </Stack>
    );
}

function RegistryTagsPicker(props: {
    tagEnabled: { tagName: string; enabled: boolean }[];
    setTagEnabled: React.Dispatch<
        React.SetStateAction<{ tagName: string; enabled: boolean }[]>
    >;
}) {
    function onClick(clickedTag: string, checked: boolean) {
        const updatedList = [...props.tagEnabled] //
            .filter((entry) => entry.tagName !== clickedTag);
        updatedList.push({
            tagName: clickedTag,
            enabled: checked,
        });
        const filteredUpdatedList = updatedList
            .sort((tagA, tagB) => {
                return tagA.tagName.localeCompare(tagB.tagName)
            });
        props.setTagEnabled([...filteredUpdatedList]);
    }

    return (
        <Stack spacing={1} useFlexGap direction='row' flexWrap='wrap'>
            {props.tagEnabled.map((_tag) => {
                return (
                    <Chip
                        size="small"
                        sx={{ borderSpacing: '3', margin:'1' }}
                        clickable={true}
                        color={_tag.enabled ? 'success':'default'}
                        onClick={(_) => {onClick(_tag.tagName, !_tag.enabled)}}
                        label={_tag.tagName}
                        key={_tag.tagName}
                    />
                );
            })}
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
        const [isYamlCopied, setYamlCopied] = React.useState(false);

        const isWideEnough = useMediaQuery('(min-width: 900px)');

        React.useEffect(() => {
            if (props.devfile.starterProjects && props.devfile.starterProjects.length > 0) {
                setSelectedTemplateProject((_) => props.devfile.starterProjects[0].name);
            }
        }, []);

        const starterProjects = props.devfile.starterProjects ? props.devfile.starterProjects : [];
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
        }, [selectedTemplateProject]);

        const isError = !starterProjects.length || (isInteracted && !selectedTemplateProject);

        return (
            <Paper
                elevation={24}
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: isWideEnough ? '900px' : 'calc(100vw - 48px)',
                    maxHeight: 'calc(100vh - 48px)',
                    transform: 'translate(-50%, -50%)',
                    padding: 2,
                }}
            >
                <Stack direction="column" spacing={2}>
                    <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        marginBottom={1}
                    >
                        <DevfileListItem devfile={props.devfile} />
                        <IconButton onClick={props.closeModal}>
                            <Close color="textSecondary" />
                        </IconButton>
                    </Stack>
                    <FormControl fullWidth>
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
                                                    component_type: props.devfile.name,
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
                                        props.setSelectedProject(selectedTemplateProject);
                                    }}
                                    disabled={!selectedTemplateProject}
                                >
                                    Use Devfile
                                </Button>
                            </Stack>
                        </Stack>
                    </FormControl>
                    <Box
                        maxHeight="400px"
                        width="100%"
                        overflow="scroll"
                        style={{ background: 'rgba(127, 127, 127, 8%)', borderRadius: '4px' }}
                    >
                        {/* paddingRight is x4 to account for the padding on the parent absolutely positioned paper and the width of the scroll bar */}
                        <Box position="absolute" paddingTop={1} paddingRight={4} right="0px">
                            <CopyToClipboard
                                text={props.devfile.yaml}
                                onCopy={() => {
                                    window.vscodeApi.postMessage({
                                        action: 'sendTelemetry',
                                        data: {
                                            actionName: 'devfileSearchCopiedYaml',
                                            properties: {
                                                // eslint-disable-next-line camelcase
                                                component_type: props.devfile.name,
                                                // eslint-disable-next-line camelcase
                                                starter_project: selectedTemplateProject,
                                            },
                                        },
                                    });
                                    setYamlCopied((_) => true);
                                }}
                            >
                                <Tooltip
                                    title={isYamlCopied ? 'Copied!' : 'Copy to clipboard'}
                                    onMouseLeave={(e) => {
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
    goBack?: () => void;
};

/**
 * Calculates if specified devfile is to be included into search results
 * based on devfile tags and tags filter. A devfile is to be included if:
 * - it contains any of selected tags
 * - always if there is no any selected tags
 *
 * @param tags1
 * @param tags2
 * @returns
 */
function isToBeIncluded(devfile: Devfile, tagFilter: string[], debugSupportFilter: boolean, deploySupportFilter: boolean): boolean {
    const includesDebugSupport = debugSupportFilter === false || debugSupportFilter === devfile.supportsDebug;
    const includesDeploySupport = deploySupportFilter === false || deploySupportFilter === devfile.supportsDeploy;
    const includesTags = tagFilter.length === 0 || devfile.tags.filter((_devfileTag) => {
        return tagFilter.find((_selectedTags) => _devfileTag === _selectedTags) !== undefined;
    }).length > 0;

    return includesDebugSupport && includesDeploySupport  &&  includesTags;
  }

export function DevfileSearch(props: DevfileSearchProps) {
    const ITEMS_PER_PAGE = 6;
    const QUARKUS_REGEX = /[Qq]uarkus/;

    const [selectedDevfile, setSelectedDevfile] = React.useState<Devfile>();
    const [currentPage, setCurrentPage] = React.useState(1);
    const [devfileRegistries, setDevfileRegistries] = React.useState<DevfileRegistry[]>([]);
    const [registryEnabled, setRegistryEnabled] = React.useState<
        { registryName: string; registryUrl: string; enabled: boolean }[]
    >([]);
    const [devfileCapabilities, setDevfileCapabilities] = React.useState<string[]>([]);
    const [capabilityEnabled, setCapabilityEnabled] = React.useState<
        { capabilityName: string; enabled: boolean }[]
    >([]);
    const [devfileTags, setDevfileTags] = React.useState<string[]>([]);
    const [tagEnabled, setTagEnabled] = React.useState<
        { tagName: string; enabled: boolean }[]
    >([]);
    const [searchText, setSearchText] = React.useState('');

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'devfileRegistries': {
                setDevfileRegistries((_devfileRegistries) => message.data);
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
                capabilityName: capability,
                enabled: false, // All values set to false means that no filter is to be applied
            });
        }
        setCapabilityEnabled((_) => enabledArray);
    }, [devfileCapabilities]);

    React.useEffect(() => {
        const enabledArray = [];
        for (const tag of devfileTags) {
            enabledArray.push({
                tagName: tag,
                enabled: false, // All values set to false means that no filter is to be applied
            });
        }
        setTagEnabled((_) => enabledArray);
    }, [devfileTags]);

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
        window.vscodeApi.postMessage({ action: 'getDevfileCapabilities' });
    }, []);

    React.useEffect(() => {
        window.vscodeApi.postMessage({ action: 'getDevfileTags' });
    }, []);

    React.useEffect(() => {
        setCurrentPage((_) => 1);
    }, [registryEnabled, capabilityEnabled, tagEnabled, searchText]);

    if (!devfileRegistries) {
        return <LoadScreen title="Retrieving list of Devfiles" />;
    }

    if(!devfileCapabilities) {
        return <LoadScreen title="Retrieving list of Devfile Capabilities" />;
    }

    if(!devfileTags) {
        return <LoadScreen title="Retrieving list of Devfile Tags" />;
    }

    const activeRegistries = registryEnabled //
        .filter((entry) => entry.enabled) //
        .map((entry) => entry.registryName);

    const debugSupport = capabilityEnabled //
        .filter((_cap) => _cap.capabilityName === 'Debug Support') //
        .filter((_cap) => _cap.enabled) //
        .length > 0;

    const deploySupport = capabilityEnabled //
        .filter((_cap) => _cap.capabilityName === 'Deploy Support') //
        .filter((_cap) => _cap.enabled) //
        .length > 0;

    const activeTags = tagEnabled
        .filter((_tag) => _tag.enabled) //
        .map((_tag) => _tag.tagName);

    const devfiles: Devfile[] = devfileRegistries //
        .filter((devfileRegistry) => activeRegistries.includes(devfileRegistry.name)) //
        .flatMap((devfileRegistry) => devfileRegistry.devfiles) //
        .filter((devfile) => isToBeIncluded(devfile, activeTags, debugSupport, deploySupport)) //
        .filter((devfile) => {
            const searchTerms = searchText.split(/\s+/);
            return every(
                searchTerms.map(
                    (searchTerm) =>
                        devfile.name.toLowerCase().includes(searchTerm) ||
                        devfile.tags.find((tag) => tag.toLowerCase().includes(searchTerm)),
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

        if (a.supportsDebug && !b.supportsDebug) {
            return -1;
        } else if (b.supportsDebug && !a.supportsDebug) {
            return 1;
        }

        return a.name < b.name ? -1 : 1;
    });

    return (
        <>
            <Stack direction="column" height="100%" spacing={3}>
                <Typography variant="h5">{props.titleText}</Typography>
                <Stack direction="row" spacing={2}>
                    <Stack direction="column" sx={{ height: 'calc(100vh - 200px - 5em)', overflow: 'scroll', maxWidth:'30%' }} spacing={0}>
                        {devfileRegistries.length > 1 && (
                            <>
                                <Typography variant="body2" marginBottom={1}>
                                    Devfile Registries
                                </Typography>
                                <Stack direction="column" sx={{width: '100%' }} width="100%" spacing={0} marginBottom={3}>
                                    <RegistriesPicker
                                        registryEnabled={registryEnabled}
                                        setRegistryEnabled={setRegistryEnabled}
                                    />
                                </Stack>
                            </>
                        )}
                        {(devfileCapabilities.length > 0 || devfileTags.length > 0) && (
                            <>
                                <Typography variant="body2" marginBottom={2}>
                                    Filter by
                                </Typography>
                                <Stack direction="column"  useFlexGap={true} width="100%" spacing={1}>
                                    {devfileCapabilities.length > 0 && (
                                        <>
                                            <RegistryCapabilitiesPicker
                                                capabilityEnabled={capabilityEnabled}
                                                setCapabilityEnabled={setCapabilityEnabled}
                                            />
                                            <Divider orientation="horizontal" sx={{width: '100%' }} />
                                        </>
                                    )}
                                    {devfileTags.length > 0 && (
                                        <RegistryTagsPicker
                                            tagEnabled={tagEnabled}
                                            setTagEnabled={setTagEnabled}
                                        />
                                    )}
                                </Stack>
                            </>
                        )}
                        <Stack direction="column" sx={{ flexGrow: '1', height: '100%', width: '100%' }} spacing={0}>
                        </Stack>
                    </Stack>
                    <Stack direction="column" spacing={3}>
                        <Divider orientation="vertical"  sx={{ height: 'calc(100vh - 200px - 5em)'}} />
                    </Stack>
                    <Stack direction="column" sx={{ flexGrow: '1' }} spacing={3}>
                        <SearchBar
                            searchText={searchText}
                            setSearchText={setSearchText}
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            numPages={
                                Math.floor(devfiles.length / ITEMS_PER_PAGE) +
                                (devfiles.length % ITEMS_PER_PAGE > 0.0001 ? 1 : 0)
                            }
                        />
                        {/* 320px is the approximate combined height of the top bar and bottom bar in the devfile search view */}
                        {/* 5em is the padding at the top of the page */}
                        <Stack
                            id="devfileList"
                            direction="column"
                            sx={{ height: 'calc(100vh - 320px - 5em)', overflow: 'scroll' }}
                            divider={<Divider />}
                            width="100%"
                        >
                            {devfiles
                                .slice(
                                    (currentPage - 1) * ITEMS_PER_PAGE,
                                    Math.min(currentPage * ITEMS_PER_PAGE, devfiles.length),
                                )
                                .map((devfile) => {
                                    return (
                                        <DevfileListItem
                                            key={`${devfile.registryName}-${devfile.name}`}
                                            devfile={devfile}
                                            buttonCallback={() => {
                                                setSelectedDevfile(devfile);
                                            }}
                                        />
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
