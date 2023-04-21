import { ExpandLess, ExpandMore } from '@mui/icons-material';
import {
    Box,
    Card,
    Collapse,
    IconButton,
    PaletteMode,
    Stack,
    ThemeProvider,
    createTheme
} from '@mui/material';
import Form from '@rjsf/mui';
import { ObjectFieldTemplateProps, TitleFieldProps } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import * as React from 'react';
import 'react-dom';

function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
    const [isExpanded, setExpanded] = React.useState(false);

    return (
        <>
            {props.title ? (
                <>
                    <Stack
                        spacing={2}
                        justifyContent='flex-start'
                        alignItems='center'
                        direction='row'
                    >
                        <Box>
                            <IconButton
                                onClick={(e) => {
                                    e.preventDefault();
                                    setExpanded(!isExpanded);
                                }}
                            >
                                {isExpanded ? <ExpandLess /> : <ExpandMore />}
                            </IconButton>
                        </Box>
                        <Box>
                            <h3>{props.title}</h3>
                        </Box>
                    </Stack>
                    <Collapse in={isExpanded}>
                        <Box borderLeft='4px solid' borderColor='rgb(43, 154, 243)' padding={2}>
                            {props.description}
                            <Stack spacing={2}>
                                {props.properties.map((element) => (
                                <div className="property-wrapper">{element.content}</div>
                                ))}
                            </Stack>
                        </Box>
                    </Collapse>
                </>
            ) : (
                <Card>
                    {props.description}
                    {props.properties.map((element) => (
                        <div className="property-wrapper">{element.content}</div>
                    ))}
                </Card>
            )}
        </>
    );
}

function TitleFieldTemplate(props: TitleFieldProps) {
    return <>
        <h3 id={props.id}>{props.title}{props.required && '*'}</h3>
    </>;
}

export function CreateForm(props) {
    console.log('creating form again');
    const [baseSchema, setBaseSchema] = React.useState({});
    const [uiSchema, setUiSchema] = React.useState({});
    const [formData, setFormData] = React.useState({});
    const [crdDescription, setCrdDescription] = React.useState({} as any);
    const [step, setStep] = React.useState('ready');
    const [themeKind, setThemeKind] = React.useState<PaletteMode>('light');

    window.addEventListener('message', (event: any) => {
        if (event?.data?.action === 'load') {
            setBaseSchema(event.data.openAPIV3Schema);
            setUiSchema(event.data.uiSchema);
            setCrdDescription(event.data.crdDescription);
            setFormData(event.data.formData);
            setStep('loaded');
        }
        if (event?.data?.action === 'error') {
            setStep('loaded');
        }
        if (event?.data?.action === 'setTheme') {
            setThemeKind(event.data.themeValue === 1 ? 'light' : 'dark');
        }
    });

    const onSubmit = (data, event: React.FormEvent<any>): void => {
        setStep('creating');
        event.preventDefault();
        window.vscodeApi.postMessage({
            command: 'create',
            formData: data.formData,
        });
    };

    const theme = React.useMemo(
        () =>
            createTheme({
                palette: {
                    mode: themeKind,
                    background: {
                        default: "rgba(0, 0, 0, 0)",
                        paper: "rgba(0, 0, 0, 0)"
                    }
                },
            }),
        [themeKind],
    );

    return (
        <ThemeProvider theme={theme}>
            {step === 'ready' && <h2>Loading ....</h2>}

            {(step === 'loaded' || step === 'creating') && (
                <div className="form-title">
                    <h1 className="label">Create {crdDescription.displayName}</h1>
                    <p className="field-description">{crdDescription.description}</p>
                    <Form
                        formData={formData}
                        schema={baseSchema}
                        uiSchema={uiSchema}
                        onChange={(e) => setFormData(e.formData)}
                        onSubmit={onSubmit}
                        liveValidate
                        validator={validator}
                        // HTML5 validation prevents the form from being submitted when some inputs are hidden,
                        // so disable it
                        noHtml5Validate
                        disabled={step === 'creating'}
                        showErrorList='top'
                        templates={{ ObjectFieldTemplate, TitleFieldTemplate }}
                    >
                    </Form>
                </div>
            )}
        </ThemeProvider>
    );
}
