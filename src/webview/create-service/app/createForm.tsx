/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { ArrowBack } from '@mui/icons-material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import {
    Alert,
    Box,
    Button,
    Collapse,
    Container,
    FormControl,
    FormHelperText,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    PaletteMode,
    Paper,
    Select,
    Stack,
    ThemeProvider,
    Typography,
} from '@mui/material';
import Form from '@rjsf/mui';
import type {
    ArrayFieldTemplateItemType,
    ArrayFieldTemplateProps,
    FormContextType,
    ObjectFieldTemplateProps,
    RJSFSchema,
    StrictRJSFSchema,
    TitleFieldProps
} from '@rjsf/utils';
import { getTemplate, getUiOptions } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import * as React from 'react';
import 'react-dom';
import { Converter } from 'showdown';
import type { CustomResourceDefinitionStub } from '../../common/createServiceTypes';
import { ErrorPage } from '../../common/errorPage';
import { LoadScreen } from '../../common/loading';
import { createVSCodeTheme } from '../../common/vscode-theme';

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
function SelectService(props: {
    serviceKinds: CustomResourceDefinitionStub[];
    selectedServiceKind: CustomResourceDefinitionStub;
    setSelectedServiceKind;
    next: () => void;
}) {
    const [isServiceKindTouched, setServiceKindTouched] = React.useState(false);

    const converter = React.useMemo(() => {
        return new Converter();
    }, []);

    const [isDocumentationExpanded, setDocumentationExpanded] = React.useState(true);

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                props.next();
            }}
        >
            <Stack direction='column' spacing={2} marginTop={3}>
                <Box paddingBottom={1}>
                    <Typography variant='h5'>Select Service Kind</Typography>
                </Box>
                <FormControl required>
                    <InputLabel id='service-kind-label'>Service Kind to Create</InputLabel>
                    <Select
                        id='service-kind'
                        labelId='service-kind-label'
                        label='Service Kind to Create'
                        value={props.selectedServiceKind ? props.selectedServiceKind.name : ''}
                        onClick={(_e) => {
                            if (!isServiceKindTouched) {
                                setServiceKindTouched(true);
                            }
                        }}
                        onChange={(e) => {
                            const newSelection = props.serviceKinds.find(
                                (serviceKind) => serviceKind.name === e.target.value,
                            );
                            props.setSelectedServiceKind((_) => newSelection);
                        }}
                        variant='outlined'
                        placeholder='Service Kind'
                        error={isServiceKindTouched && props.selectedServiceKind === undefined}
                        required
                    >
                        {props.serviceKinds.map((serviceKind) => (
                            <MenuItem key={serviceKind.name} value={serviceKind.name}>
                                {serviceKind.kind} - <em>{serviceKind.name}</em>
                            </MenuItem>
                        ))}
                    </Select>
                    <FormHelperText>The type of Operator-backed service to create</FormHelperText>
                </FormControl>
                {props.selectedServiceKind && props.selectedServiceKind.csvDescription && (
                    <Paper variant='elevation'>
                        <Box margin={1}>
                            <Stack
                                direction='row'
                                width='100%'
                                alignItems='center'
                                justifyContent='space-between'
                                spacing={3}
                            >
                                <Stack marginLeft={1} spacing={1} direction='row'>
                                    <IconButton
                                        size='small'
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setDocumentationExpanded(!isDocumentationExpanded);
                                        }}
                                    >
                                        {isDocumentationExpanded ? <ExpandLess /> : <ExpandMore />}
                                    </IconButton>
                                    <Typography variant='h6'>Operator Documentation:</Typography>
                                </Stack>
                                <Alert severity='warning'>
                                    Most Operators require additional setup after installation that
                                    is described here.
                                </Alert>
                            </Stack>
                            <Collapse in={isDocumentationExpanded}>
                                <Box margin={1}>
                                    <div
                                        dangerouslySetInnerHTML={{
                                            __html: converter.makeHtml(
                                                props.selectedServiceKind.csvDescription,
                                            ),
                                        }}
                                    ></div>
                                </Box>
                            </Collapse>
                        </Box>
                    </Paper>
                )}
                <Stack direction='row-reverse' width='100%'>
                    {props.selectedServiceKind ? (
                        <Button
                            variant='contained'
                            size='large'
                            type='submit'
                            sx={{ textTransform: 'none' }}
                        >
                            Next
                        </Button>
                    ) : (
                        <Alert severity='error'>You must select a type of service to create.</Alert>
                    )}
                </Stack>
            </Stack>
        </form>
    );
}

/**
 * Component to set the required fields for the selected CRD using an RJSF form.
 */
function SpecifyService(props: {
    serviceKind: CustomResourceDefinitionStub;
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
    const [serviceKinds, setServiceKinds] = React.useState<CustomResourceDefinitionStub[]>([]);
    const [selectedServiceKind, setSelectedServiceKind] =
        React.useState<CustomResourceDefinitionStub>(undefined);
    const [spec, setSpec] = React.useState<object>(undefined);
    const [defaults, setDefaults] = React.useState<object>(undefined);

    const [themeKind, setThemeKind] = React.useState<PaletteMode>('light');
    const theme = React.useMemo(() => createVSCodeTheme(themeKind), [themeKind]);
    const [error, setError] = React.useState<string>(undefined);

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
            return <LoadScreen title='Loading...' />;
        case 'Error':
            return <ErrorPage message={error} />;
        case 'PickServiceKind':
            pageElement = (
                <SelectService
                    serviceKinds={serviceKinds}
                    selectedServiceKind={selectedServiceKind}
                    setSelectedServiceKind={setSelectedServiceKind}
                    next={() => {
                        window.vscodeApi.postMessage({
                            command: 'getSpec',
                            data: selectedServiceKind,
                        });
                        setPage((_) => 'Loading');
                    }}
                />
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
