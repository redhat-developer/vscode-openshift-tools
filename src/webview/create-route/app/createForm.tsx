/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import {
    Box,
    Collapse,
    Container,
    FormControl,
    IconButton,
    PaletteMode,
    Paper,
    Stack,
    ThemeProvider,
    Typography,
    TextField,
    Grid,
    FormHelperText,
    MenuItem,
    Select,
    InputLabel,
    Checkbox,
    FormControlLabel
} from '@mui/material';
import Form from '@rjsf/mui';
import type {
    ObjectFieldTemplateProps,
    TitleFieldProps,
    ArrayFieldTemplateProps,
    RJSFSchema,
    StrictRJSFSchema,
    FormContextType,
    ArrayFieldTemplateItemType
} from '@rjsf/utils';
import { getTemplate, getUiOptions } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import * as React from 'react';
import 'react-dom';
import type { K8sResourceKind, Port } from '../../common/createServiceTypes';
import type { RouteInputBoxText } from '../../common/route';
import { LoadScreen } from '../../common/loading';
import { createVSCodeTheme } from '../../common/vscode-theme';
import { ArrowBack } from '@mui/icons-material';
import { ErrorPage } from '../../common/errorPage';

/**
 * A replacement for the RJSF object field component that resembles the one in Patternfly and allows collapsing.
 */
function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
    const [isExpanded, setExpanded] = React.useState(true);

    return (
        <>
            {props.title ? (
                <>
                    <Stack
                        spacing={1}
                        justifyContent='flex-start'
                        alignItems='center'
                        direction='row'
                    >
                        <Box>
                            <IconButton
                                size='small'
                                onClick={(e) => {
                                    e.preventDefault();
                                    setExpanded(!isExpanded);
                                }}
                            >
                                {isExpanded ? <ExpandLess /> : <ExpandMore />}
                            </IconButton>
                        </Box>
                        <Stack direction='row' alignItems='baseline' spacing={2}>
                            <Typography variant='h4'>
                                {props.title}
                                {props.required && ' *'}
                            </Typography>
                            <Typography variant='body1' maxWidth='600px' textOverflow='ellipsis' overflow='hidden'>
                                {props.description}
                            </Typography>
                        </Stack>
                    </Stack>
                    <Collapse in={isExpanded}>
                        <Box
                            borderLeft='2px solid'
                            borderColor='var(--vscode-button-background)'
                            paddingLeft={1}
                        >
                            <Stack spacing={2}>
                                {props.properties.map((element) => (
                                    <div className='property-wrapper'>{element.content}</div>
                                ))}
                            </Stack>
                        </Box>
                    </Collapse>
                </>
            ) : (
                <>
                    <Stack spacing={1}>
                        {props.properties.map((element) => (
                            <div className='property-wrapper'>{element.content}</div>
                        ))}
                    </Stack>
                </>
            )}
        </>
    );
}

/**
 * Based on https://github.com/rjsf-team/react-jsonschema-form/blob/main/packages/mui/src/ArrayFieldTemplate/ArrayFieldTemplate.tsx
 */
function ArrayFieldTemplate<
    T = any,
    S extends StrictRJSFSchema = RJSFSchema,
    F extends FormContextType = any,
>(props: ArrayFieldTemplateProps<T, S, F>) {
    const {
        canAdd,
        disabled,
        uiSchema,
        items,
        onAddClick,
        schema,
        readonly,
        registry,
        required,
        title,
    } = props;

    const uiOptions = getUiOptions<T, S, F>(uiSchema);
    const ArrayFieldItemTemplate = getTemplate<'ArrayFieldItemTemplate', T, S, F>(
        'ArrayFieldItemTemplate',
        registry,
        uiOptions,
    );

    const {
        ButtonTemplates: { AddButton },
    } = registry.templates;
    return (
        <Paper variant='outlined'>
            <Stack direction='column' spacing={1} p={2}>
                <Stack direction='row' spacing={2} alignItems='baseline'>
                    <Typography variant='h4'>
                        {title}
                        {required && ' *'}
                    </Typography>
                    <Typography variant='body1' maxWidth='600px' textOverflow='ellipsis'>
                        {schema.description}
                    </Typography>
                </Stack>
                {items &&
                    items.map(({ key, ...itemProps }: ArrayFieldTemplateItemType<T, S, F>) => (
                        <ArrayFieldItemTemplate key={key} {...itemProps} />
                    ))}
                {canAdd && (
                    <Grid container justifyContent='flex-end'>
                        <Grid item={true}>
                            <Box mt={2}>
                                <AddButton
                                    className='array-item-add'
                                    onClick={onAddClick}
                                    disabled={disabled || readonly}
                                    uiSchema={uiSchema}
                                    registry={registry}
                                />
                            </Box>
                        </Grid>
                    </Grid>
                )}
            </Stack>
        </Paper>
    );
}

function TitleFieldTemplate(props: TitleFieldProps) {
    return (
        <>
            <h4 id={props.id}>
                {props.title}
                {props.required && '*'}
            </h4>
        </>
    );
}

/**
 * Component to select which type of service (which CRD) should be created.
 */
function LoadForm(props: {
    routeNameObj: RouteInputBoxText;
    hostNameObj: RouteInputBoxText;
    pathObj: RouteInputBoxText;
    serviceKinds: K8sResourceKind[];
    selectedServiceKind: K8sResourceKind;
    setSelectedServiceKind;
    selectedPort: Port;
    setSelectedPort;
}) {

    const [isServiceKindTouched, setServiceKindTouched] = React.useState(false);
    const [isPortTouched, setPortTouched] = React.useState(false);
    const [isSecured, setSecured] = React.useState(false);
    const [ports, setPorts] = React.useState<Port[]>([]);

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
            }}
        >
            <Stack direction='column' spacing={2} marginTop={3}>
                <Box paddingBottom={1}>
                    <Typography variant='h5'>Create Route</Typography>
                </Box>
                <TextField fullWidth
                    id='routeName'
                    variant='outlined'
                    label='Name'
                    placeholder='my-route'
                    required
                    value={props.routeNameObj.name}
                    error={props.routeNameObj.error}
                    helperText={props.routeNameObj.helpText}
                    onChange={(e) => {
                        window.vscodeApi.postMessage({
                            command: 'validateRouteName',
                            data: e.target.value
                        });
                    }} />
                <TextField fullWidth
                    id='hostName'
                    variant='outlined'
                    label='Hostname'
                    placeholder='www.example.com'
                    value={props.hostNameObj.name}
                    error={props.hostNameObj.error}
                    helperText={props.hostNameObj.helpText}
                    onChange={(e) => {
                        window.vscodeApi.postMessage({
                            command: 'validateHostName',
                            data: e.target.value
                        });
                    }} />
                <TextField fullWidth
                    id='path'
                    variant='outlined'
                    label='Path'
                    placeholder='/'
                    value={props.pathObj.name}
                    error={props.pathObj.error}
                    helperText={props.pathObj.helpText}
                    onChange={(e) => {
                        window.vscodeApi.postMessage({
                            command: 'validateHostName',
                            data: e.target.value
                        });
                    }} />
                <FormControl required>
                    <InputLabel id='service-kind-label'>Service</InputLabel>
                    <Select
                        id='service-kind'
                        labelId='service-kind-label'
                        label='Service'
                        value={props.selectedServiceKind ? props.selectedServiceKind.metadata.name : ''}
                        onClick={(_e) => {
                            if (!isServiceKindTouched) {
                                setServiceKindTouched(true);
                            }
                        }}
                        onChange={(e) => {
                            const newSelection = props.serviceKinds.find(
                                (serviceKind: K8sResourceKind) => serviceKind.metadata.name === e.target.value,
                            );
                            props.setSelectedServiceKind((_) => newSelection);
                            setPorts((_) => newSelection.spec.ports);
                        }}
                        variant='outlined'
                        placeholder='Select a service'
                        error={isServiceKindTouched && props.selectedServiceKind === undefined}
                        required
                    >
                        {props.serviceKinds.map((serviceKind: K8sResourceKind) => (
                            <MenuItem key={serviceKind.metadata.name} value={serviceKind.metadata.name}>
                                {serviceKind.metadata.name}
                            </MenuItem>
                        ))}
                    </Select>
                    <FormHelperText>Service to route to.</FormHelperText>
                </FormControl>
                <FormControl required>
                    <InputLabel id='target-port-label'>Target Port</InputLabel>
                    <Select
                        id='target-port'
                        labelId='target-port-label'
                        label='Target Port'
                        value={props.selectedPort ? props.selectedPort.port : ''}
                        disabled={!props.selectedServiceKind}
                        onClick={(_e) => {
                            if (!isPortTouched) {
                                setPortTouched(true);
                            }
                        }}
                        onChange={(e) => {
                            const newSelection = ports.find(
                                (port: Port) => port.port === e.target.value,
                            );
                            props.setSelectedPort((_) => newSelection);
                        }}
                        variant='outlined'
                        placeholder='Select target port'
                        error={isServiceKindTouched && props.selectedServiceKind === undefined}
                        required
                    >
                        {ports.map((portObj: Port) => (
                            <MenuItem key={portObj.port} value={portObj.port}>
                                {portObj.port} ​&#8594; {portObj.targetPort} ({portObj.protocol})
                            </MenuItem>
                        ))}
                    </Select>
                    <FormHelperText>Target Port for traffic</FormHelperText>
                </FormControl>
                <FormControl>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={isSecured}
                                onClick={(_) => {
                                    setSecured((isSecured) => !isSecured);
                                }} />
                        }
                        label='Secure Route'
                    />
                    <FormHelperText>Routes can be secured using several TLS termination types for serving certificates.</FormHelperText>
                </FormControl>
            </Stack>
        </form >
    );
}

/**
 * Component to set the required fields for the selected CRD using an RJSF form.
 */
function SpecifyService(props: {
    serviceKind: K8sResourceKind;
    spec: object;
    defaults: object;
    next: () => void;
    back: () => void;
}) {
    const [formData, setFormData] = React.useState<object>(props.defaults);

    const onSubmit = (_data, event: React.FormEvent<any>): void => {
        event.preventDefault();
        window.vscodeApi.postMessage({
            command: 'create',
            data: formData,
        });
        props.next();
    };

    return (
        <Stack direction='column' spacing={3} marginY={3}>
            <Stack direction='row' spacing={2}>
                <IconButton onClick={props.back} aria-label='back'>
                    <ArrowBack color='action' />
                </IconButton>
                <Typography variant='h5'>Create {props.serviceKind.kind}</Typography>
            </Stack>
            <Form
                formData={formData}
                schema={props.spec}
                onChange={(e) => setFormData((_) => e.formData)}
                onSubmit={onSubmit}
                liveValidate
                noHtml5Validate
                validator={validator}
                showErrorList='top'
                templates={{ ObjectFieldTemplate, TitleFieldTemplate, ArrayFieldTemplate }}
            ></Form>
        </Stack>
    );
}

type CreateServicePage = 'Loading' | 'PickServiceKind' | 'ConfigureService' | 'Error';

export function CreateService() {
    const [page, setPage] = React.useState<CreateServicePage>('Loading');
    const [spec, setSpec] = React.useState<object>(undefined);
    const [defaults, setDefaults] = React.useState<object>(undefined);

    const [themeKind, setThemeKind] = React.useState<PaletteMode>('light');
    const theme = React.useMemo(() => createVSCodeTheme(themeKind), [themeKind]);
    const [error, setError] = React.useState<string>(undefined);

    const [routeNameObj, setRouteNameObj] = React.useState<RouteInputBoxText>({
        name: '',
        error: false,
        helpText: 'A unique name for the Route within the project.'
    });

    const [hostNameObj, setHostNameObj] = React.useState<RouteInputBoxText>({
        name: '',
        error: false,
        helpText: 'Public host name for the Route. If not specified, a hostname is generated.'
    });

    const [pathObj, setPathObj] = React.useState<RouteInputBoxText>({
        name: '',
        error: false,
        helpText: 'Path that the router watches to route traffic to the service.'
    });

    const [serviceKinds, setServiceKinds] = React.useState<K8sResourceKind[]>(undefined);
    const [selectedServiceKind, setSelectedServiceKind] =
        React.useState<K8sResourceKind>(undefined);
    const [selectedPort, setSelectedPort] =
        React.useState<Port>(undefined);

    function messageListener(event) {
        if (event?.data) {
            const message = event.data;
            switch (message.action) {
                case 'setTheme':
                    setThemeKind(event.data.themeValue === 1 ? 'light' : 'dark');
                    break;
                case 'setServiceKinds':
                    setServiceKinds((_) => message.data);
                    setPage((_) => 'PickServiceKind');
                    break;
                case 'setSpec':
                    setSpec(message.data.spec);
                    setDefaults(message.data.defaults);
                    setPage('ConfigureService');
                    break;
                case 'validateRouteName':
                    setRouteNameObj({
                        name: message.data.name,
                        error: message.data.error,
                        helpText: message.data.helpText !== '' ? message.data.helpText : routeNameObj.helpText
                    });
                    break;
                case 'validateHostName':
                    setHostNameObj({
                        name: message.data.name,
                        error: message.data.error,
                        helpText: message.data.helpText !== '' ? message.data.helpText : hostNameObj.helpText
                    });
                    break;
                case 'validatePath':
                    setPathObj({
                        name: message.data.name,
                        error: message.data.error,
                        helpText: message.data.helpText
                    });
                    break;
                case 'error':
                    setError((prev) => message.data)
                    setPage((prev) => 'Error');
                    break;
                default:
                    break;
            }
        }
    }

    React.useEffect(() => {
        window.addEventListener('message', messageListener);
        return () => {
            window.removeEventListener('message', messageListener);
        };
    }, []);

    let pageElement;

    switch (page) {
        case 'Loading':
            return <LoadScreen title='Loading ...' />;
        case 'Error':
            return <ErrorPage message={error} />;
        case 'PickServiceKind':
            pageElement = (
                <LoadForm
                    routeNameObj={routeNameObj}
                    hostNameObj={hostNameObj}
                    pathObj={pathObj}
                    serviceKinds={serviceKinds}
                    selectedServiceKind={selectedServiceKind}
                    setSelectedServiceKind={setSelectedServiceKind}
                    selectedPort={selectedPort}
                    setSelectedPort={setSelectedPort} />
            );
            break;
        case 'ConfigureService':
            pageElement = (
                <SpecifyService
                    serviceKind={selectedServiceKind}
                    spec={spec}
                    defaults={defaults}
                    next={() => {
                        setPage('Loading');
                    }}
                    back={() => {
                        setPage('PickServiceKind');
                    }}
                />
            );
            break;
        default:
            <>Error</>;
    }

    return (
        <ThemeProvider theme={theme}>
            <Container maxWidth='lg'>{pageElement}</Container>
        </ThemeProvider>
    );
}
