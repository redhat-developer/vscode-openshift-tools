/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container,
    createTheme,
    FormControl,
    FormHelperText,
    FormLabel,
    Grid,
    InputLabel,
    MenuItem,
    PaletteMode,
    Select,
    Stack,
    TextField,
    Theme,
    ThemeProvider
} from '@mui/material';
import * as React from 'react';
import 'react-dom';

interface VSCodeMessage {
    action: string;
    themeValue?: number;
    availableServices?: string[];
    componentName?: string;
}

export function AddServiceBindingForm() {
    // These are passed in after the component is created using the VS Code API
    const [availableServices, setAvailableServices] = React.useState<string[]>(undefined);
    const [componentName, setComponentName] = React.useState<string>(undefined);

    const [selectedService, setSelectedService] = React.useState('');
    const [bindingName, setBindingName] = React.useState('');

    // Only mark a form field as an error after the user has first interacted with it
    const [selectedServiceTouched, setSelectedServiceTouched] = React.useState<boolean>(false);
    const [bindingNameTouched, setBindingNameTouched] = React.useState<boolean>(false);

    const createVscodeTheme = (paletteMode: PaletteMode): Theme => {
        const computedStyle = window.getComputedStyle(document.body);
        return createTheme({
            palette: {
                mode: paletteMode,
                primary: {
                    main: computedStyle.getPropertyValue('--vscode-button-background'),
                },
                error: {
                    main: computedStyle.getPropertyValue('--vscode-editorError-foreground'),
                },
                warning: {
                    main: computedStyle.getPropertyValue('--vscode-editorWarning-foreground'),
                },
                info: {
                    main: computedStyle.getPropertyValue('--vscode-editorInfo-foreground'),
                },
                success: {
                    main: computedStyle.getPropertyValue('--vscode-debugIcon-startForeground'),
                },
            },
            typography: {
                allVariants: {
                    fontFamily: computedStyle.getPropertyValue('--vscode-font-family'),
                },
            },
        });
    };

    const [theme, setTheme] = React.useState<Theme>(createVscodeTheme('light'));

    const respondToMessage = function (message: MessageEvent<VSCodeMessage>) {
        if (message.data.action === 'setTheme') {
            setTheme(createVscodeTheme(message.data.themeValue === 1 ? 'light' : 'dark'));
        } else if (message.data.action === 'setAvailableServices') {
            setAvailableServices(message.data.availableServices);
        } else if (message.data.action === 'setComponentName') {
            setComponentName(message.data.componentName);
        }
    };

    React.useEffect(() => {
        window.addEventListener('message', respondToMessage);
        return () => {
            window.removeEventListener('message', respondToMessage);
        };
    }, []);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        window.vscodeApi.postMessage({
            action: 'addServiceBinding',
            params: {
                selectedService,
                bindingName,
            },
        } as ActionMessage);
    };

    const isBindingNameValid = (name: string): boolean => {
        return /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name);
    };

    return (
        <ThemeProvider theme={theme}>
            {availableServices && componentName ? (
                <Container maxWidth="md">
                    <form onSubmit={handleSubmit}>
                        <Stack spacing={3} marginTop={3}>
                            <FormLabel>
                                Bind Service to <code>{componentName}</code>
                            </FormLabel>
                            <FormControl required>
                                <InputLabel>Service to Bind</InputLabel>
                                <Select
                                    id="service"
                                    value={selectedService}
                                    label="Service to Bind"
                                    onClick={(_e) => {
                                        if (!selectedServiceTouched) {
                                            setSelectedServiceTouched(true);
                                        }
                                    }}
                                    onChange={(e) => {
                                        setSelectedService(e.target.value);
                                    }}
                                    variant="outlined"
                                    placeholder="Service Name"
                                    error={selectedServiceTouched && selectedService === ''}
                                    required
                                >
                                    {availableServices.map((serviceOption) => (
                                        <MenuItem key={serviceOption} value={serviceOption}>
                                            {serviceOption}
                                        </MenuItem>
                                    ))}
                                </Select>
                                <FormHelperText>
                                    The Operator-backed service to connect to your component
                                </FormHelperText>
                            </FormControl>
                            <FormControl>
                                <TextField
                                    id="binding-name"
                                    variant="outlined"
                                    label="Binding Name"
                                    onClick={(_e) => {
                                        if (!bindingNameTouched) {
                                            setBindingNameTouched(true);
                                        }
                                    }}
                                    onChange={(e) => {
                                        setBindingName(e.target.value);
                                    }}
                                    error={bindingNameTouched && !isBindingNameValid(bindingName)}
                                    required
                                ></TextField>
                                <FormHelperText>
                                    The name of the <code>ServiceBinding</code> Kubernetes resource.
                                    Can only contain letters, numbers, and dashes (<code>-</code>).
                                </FormHelperText>
                            </FormControl>
                            <Grid container>
                                <Grid item xs="auto">
                                    {/* Instead of disabling the button when the form entries are invalid,
                                    completely remove it, and instead show an alert explaining what needs to be fixed */}
                                    {!isBindingNameValid(bindingName) || selectedService === '' ? (
                                        <Alert severity="error">
                                            You must&nbsp;
                                            {selectedService === '' && (
                                                <>select a service to bind to</>
                                            )}
                                            {!isBindingNameValid(bindingName) &&
                                                selectedService === '' && <> and </>}
                                            {!isBindingNameValid(bindingName) && (
                                                <>set a valid binding name</>
                                            )}
                                            .
                                        </Alert>
                                    ) : (
                                        <Button
                                            variant="contained"
                                            size="large"
                                            type="submit"
                                            sx={{ textTransform: 'none' }}
                                        >
                                            Add Service Binding
                                        </Button>
                                    )}
                                </Grid>
                                <Grid item xs></Grid>
                            </Grid>
                        </Stack>
                    </form>
                </Container>
            ) : (
                <Box
                    position="fixed"
                    top="0"
                    left="0"
                    width="100vw"
                    height="100vh"
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                >
                    <CircularProgress />
                </Box>
            )}
        </ThemeProvider>
    );
}
