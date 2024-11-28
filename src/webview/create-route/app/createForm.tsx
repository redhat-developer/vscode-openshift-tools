/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import {
    Box,
    Button,
    Checkbox,
    Container,
    FormControl,
    FormControlLabel,
    FormHelperText,
    InputLabel,
    MenuItem,
    PaletteMode,
    Select,
    Stack,
    TextField,
    ThemeProvider,
    Typography
} from '@mui/material';
import * as React from 'react';
import 'react-dom';
import type { K8sResourceKind, Port } from '../../common/createServiceTypes';
import { ErrorPage } from '../../common/errorPage';
import { LoadScreen } from '../../common/loading';
import type { RouteInputBoxText } from '../../common/route';
import { createVSCodeTheme } from '../../common/vscode-theme';

/**
 * Component to select which type of service (which CRD) should be created.
 */
function SelectService(props: {
    routeNameObj: RouteInputBoxText;
    setRouteNameObj;
    hostNameObj: RouteInputBoxText;
    setHostNameObj;
    pathObj: RouteInputBoxText;
    setPathNameObj;
    serviceKinds: K8sResourceKind[];
    selectedServiceKind: K8sResourceKind;
    setSelectedServiceKind;
    ports: Port[],
    setPorts;
    selectedPort: Port;
    setSelectedPort;
}) {

    const [isServiceKindTouched, setServiceKindTouched] = React.useState(false);
    const [isPortTouched, setPortTouched] = React.useState(false);
    const [isSecured, setSecured] = React.useState(false);

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
                        props.setRouteNameObj((prevState: RouteInputBoxText) => ({ ...prevState, name: e.target.value }));
                    }}
                />
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
                            command: 'validateHost',
                            data: e.target.value
                        });
                        props.setHostNameObj((prevState: RouteInputBoxText) => ({ ...prevState, name: e.target.value }));
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
                            command: 'validatePath',
                            data: e.target.value
                        });
                        props.setPathNameObj((prevState: RouteInputBoxText) => ({ ...prevState, name: e.target.value }));
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
                            props.setPorts((_) => newSelection.spec.ports);
                            props.setSelectedPort((_) => undefined);
                        }}
                        variant='outlined'
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
                            const newSelection = props.ports.find(
                                (port: Port) => port.port === e.target.value,
                            );
                            props.setSelectedPort((_) => newSelection);
                        }}
                        variant='outlined'
                        error={isServiceKindTouched && props.selectedServiceKind === undefined}
                        required
                    >
                        {props.ports.map((portObj: Port) => (
                            <MenuItem key={portObj.port} value={portObj.port}>
                                {portObj.port} <ArrowRightAltIcon /> {portObj.targetPort} ({portObj.protocol})
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
                <Stack direction='row' spacing={2} marginTop={3}>
                    <Button
                        variant='contained'
                        onClick={() => {
                            window.vscodeApi.postMessage({
                                command: 'create',
                                data: {
                                    routeName: props.routeNameObj.name.trim(),
                                    hostname: props.hostNameObj.name.trim(),
                                    path: props.pathObj.name.trim(),
                                    serviceName: props.selectedServiceKind.metadata.name.trim(),
                                    port: {
                                        number: props.selectedPort.port,
                                        targetPort: props.selectedPort.targetPort,
                                        name: props.selectedPort.name,
                                        protocal: props.selectedPort.protocol
                                    },
                                    isSecured
                                },
                            });
                        }}
                        disabled={props.routeNameObj.name.trim().length === 0 || props.routeNameObj.error || props.hostNameObj.error || !props.selectedServiceKind || !props.selectedPort}
                    >
                        Create
                    </Button>
                    <Button
                        variant='contained'
                        onClick={() => {
                            window.vscodeApi.postMessage({
                                command: 'close'
                            });
                        }}>
                        Cancel
                    </Button>
                </Stack>
            </Stack>
        </form >
    );
}

type CreateServicePage = 'Loading' | 'PickServiceKind' | 'Error';

export function CreateService() {
    const [page, setPage] = React.useState<CreateServicePage>('Loading');

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
    const [ports, setPorts] = React.useState<Port[]>([]);
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
                case 'validateRouteName': {
                    const routeData: RouteInputBoxText = JSON.parse(message.data) as unknown as RouteInputBoxText;
                    setRouteNameObj({
                        name: routeData.name,
                        error: routeData.error,
                        helpText: routeData.helpText !== '' ? routeData.helpText : routeNameObj.helpText
                    });
                    break;

                }
                case 'validateHost': {
                    const hostData: RouteInputBoxText = JSON.parse(message.data) as unknown as RouteInputBoxText;
                    setHostNameObj({
                        name: hostData.name,
                        error: hostData.error,
                        helpText: hostData.helpText !== '' ? hostData.helpText : hostNameObj.helpText
                    });
                    break;
                }
                case 'validatePath': {
                    const PathData: RouteInputBoxText = JSON.parse(message.data) as unknown as RouteInputBoxText;
                    setPathObj({
                        name: PathData.name,
                        error: PathData.error,
                        helpText: PathData.helpText
                    });
                    break;
                }
                case 'error':
                    setError(() => message.data)
                    setPage(() => 'Error');
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
            pageElement = (<ErrorPage message={error} />);
            break;
        case 'PickServiceKind':
            pageElement = (
                <SelectService
                    routeNameObj={routeNameObj}
                    setRouteNameObj={setRouteNameObj}
                    hostNameObj={hostNameObj}
                    setHostNameObj={setHostNameObj}
                    pathObj={pathObj}
                    setPathNameObj={setPathObj}
                    serviceKinds={serviceKinds}
                    selectedServiceKind={selectedServiceKind}
                    setSelectedServiceKind={setSelectedServiceKind}
                    ports={ports}
                    setPorts={setPorts}
                    selectedPort={selectedPort}
                    setSelectedPort={setSelectedPort} />
            );
            break;
        default:
            <>Error</>;
    }

    return (
        <ThemeProvider theme={theme}>
            <Container maxWidth='lg'>
                {pageElement}
                {error?.trim().length > 0 &&
                    <Stack direction='row' spacing={2} marginTop={3}>
                        <Button
                            variant='contained'
                            onClick={() => {
                                setError(() => undefined);
                                setPage((_) => 'PickServiceKind');
                            }}
                        >
                            Back
                        </Button>
                    </Stack>
                }
            </Container>
        </ThemeProvider>
    );
}
