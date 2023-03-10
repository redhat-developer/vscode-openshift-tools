/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as React from 'react';
import { Button, CircularProgress, TextField } from '@material-ui/core';
import { styled, ThemeProvider } from '@mui/styles';
import AccountCircle from '@mui/icons-material/AccountCircle';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css'
import './clusterView.scss';
import { ClusterViewTheme } from './clusterView.style';

const CodeTextField = styled(TextField)({
    verticalAlign: 'middle',
    '& label.Mui-focused': {
        color: 'var(--vscode-focusBorder)',
    },
    '& .MuiInputLabel-root': {
        color: 'var(--vscode-input-placeholderForeground)'
    },
    '& .MuiOutlinedInput-root': {
        background: 'var(--vscode-input-background)',
        color: 'var(--vscode-input-foreground)',
        '& fieldset': {
            borderWidth: '0px',
        },
        '&:hover fieldset': {
            border: '2px',
            borderStyle: 'solid',
            borderColor: 'var(--vscode-focusBorder)',
        },
        '&.Mui-focused fieldset': {
            border: '2px',
            borderStyle: 'solid',
            borderColor: 'var(--vscode-focusBorder)',
        },
    },
});

function ShowProgress(props: {size: number}): JSX.Element {
    return (
        <CircularProgress
            style={{
                color: 'var(--vscode-button-foreground)',
                marginLeft: '10px'
            }}
            size={props.size}
        />);
}

export default function addSandboxView(props): JSX.Element {
    const [currentState, setCurrentState] = React.useState({
        action: 'sandboxPageDetectAuthSession',
        statusInfo: '',
        consoleDashboard: '',
        apiEndpoint: '',
        oauthTokenEndpoint: '',
        errorCode: undefined
    });

    const messageListener = (event) => {
        if (event?.data?.action) {
            setCurrentState(event.data);
        }
    }

    window.addEventListener('message', messageListener);

    function postMessage(action: string, payload?: any): void {
        window.vscodeApi.postMessage({ action, payload });
    }

    React.useEffect(() => {
        postMessage('sandboxCheckAuthSession');
    }, []);

    const DetectAuthSession = () => {
        return (
            <>
                {(currentState.action === 'sandboxPageDetectAuthSession') && (
                    <div style = {{ margin: '20px'}}>
                        <ShowProgress size={20}/>
                        <Typography component='p'>Detecting Authentication Session</Typography>
                    </div>
                )}
            </>
        );
    };

    const Login = () => {

        const [inProgress, setInProgress] = React.useState(false)

        const handleLoginButton = () => {
            setInProgress(true);
            postMessage('sandboxLoginRequest');
        }

        return (
            <>
                {( currentState.action === 'sandboxPageLoginRequired' ) && (
                    <div>
                        <div style={{ margin: '20px' }}>
                            <Typography variant='body2' component='p' sx={{ flexGrow: 1 }}>
                                Sign up for a new Red Hat developer account OR Login to an existing account to start using Developer Sandbox for Red Hat OpenShift.
                            </Typography>
                            {(currentState.errorCode === 'loginTimedOut') && (
                                <div>
                                    Login command timed out. Please try again.
                                </div>
                            )}
                        </div>
                        <div style={{ margin: '20px' }}>
                            <Button
                                href='https://red.ht/3MkQ54W'
                                variant='contained'
                                className='buttonSecondary'
                                style= {{ marginRight: '10px' }}>
                                    Sign Up
                            </Button>
                            <Button
                                className='button'
                                disabled={inProgress}
                                variant='outlined'
                                onClick={ handleLoginButton }>
                                Login to Red Hat{ inProgress && <ShowProgress size={10}/>}
                            </Button>
                        </div>
                    </div>
                )}
            </>
        )
    };

    const DetectStatus = () => {

        React.useEffect(() => {
            if (currentState.action === 'sandboxPageDetectStatus' && currentState.errorCode === undefined) {
                postMessage('sandboxDetectStatus');
            }
        }, []);

        const handleTryAgainButton = () => {
            setCurrentState({
                action: currentState.action,
                consoleDashboard: currentState.consoleDashboard,
                statusInfo: currentState.statusInfo,
                apiEndpoint: '',
                oauthTokenEndpoint: '',
                errorCode: undefined
            });
            postMessage('sandboxDetectStatus');
        }

        return (
            <>
                {( currentState.action === 'sandboxPageDetectStatus' ) && (
                    <div style = {{ margin: '20px'}}>
                        {(currentState.errorCode === undefined) && (
                            <>
                                <ShowProgress size={20}/>
                                <Typography component='p'>
                                    Detecting Developer Sandbox instance status
                                </Typography>
                            </>
                        )}
                        {(currentState.errorCode) && (
                            <>
                                <Typography component='p'>
                                    Could not detect Developer Sandbox instance status
                                </Typography>
                                <Button style= {{ margin: '20px' }} className='button' variant='contained' onClick={handleTryAgainButton}>Try Again</Button>
                            </>
                        )}
                    </div>
                )}
            </>
        )
    };

    const Signup = () => {

        const [inProgress, setInProgress] = React.useState(false)

        const handleSignupButton = (event) => {
            setInProgress(true);
            postMessage('sandboxRequestSignup');
        }
        return (
            <>
                {( currentState.action === 'sandboxPageRequestSignup' ) && (
                    <div style = {{ margin: '20px'}}>
                        <div>
                            You have not signed up for Developer Sandbox for Red Hat OpenShift.<br/>
                            Provision your free Red Hat OpenShift development cluster and get started.
                        </div>
                        <div>
                            <Button
                                style= {{ margin: '20px' }}
                                className='button'
                                disabled={inProgress}
                                variant='outlined'
                                onClick={handleSignupButton}>Get started in the Sandbox{ inProgress && <ShowProgress size={10}/>}</Button>
                        </div>
                    </div>
                )}
            </>
        )
    };

    const RequestVerificationCode = () => {

        const [phoneNumber, setPhoneNumber] = React.useState('');
        const [countryCode, setCountryCode] = React.useState('');

        const handlePhoneNumber = (value, country) => {
            setPhoneNumber(value);
            setCountryCode(country.dialCode);
        }

        const [inProgress, setInProgress] = React.useState(false)

        const handleRequestVerificationCode = () => {
            const rawPhoneNumber = phoneNumber.slice(countryCode.length);
            const fullCountryCode = '+' + countryCode;

            setInProgress(true);
            postMessage('sandboxRequestVerificationCode', { rawPhoneNumber, fullCountryCode });
        }

        const isValid = (value, country) => {
            const validNumberCount = (country.format.match(/\./g) || []).length;
            return value.length === validNumberCount;
        };

        return (
            <>
                {( currentState.action === 'sandboxPageRequestVerificationCode' ) && (
                    <div style = {{ margin: '20px', position: 'relative'}}>
                        <PhoneInput
                        country={'us'}
                        value={phoneNumber}
                        onChange={handlePhoneNumber}
                        isValid={isValid}
                        disabled={inProgress}
                        containerStyle={{display: 'inline-flex', margin: '20px 10px 20px 10px', width: 'unset'}}
                        dropdownStyle = {{
                            position: 'fixed',
                            margin: '0px 0 10px -1px',
                            textAlign: 'initial',
                            background: 'var(--vscode-settings-textInputBackground)',
                            border: '0.5px solid',
                            borderColor: 'var(--vscode-focusBorder)'
                        }}
                        buttonStyle = {{
                            border: '0.5px solid',
                            borderColor: 'var(--vscode-focusBorder)'
                        }}
                        inputStyle = {{
                        width: '10rem !important',
                        background: 'var(--vscode-settings-textInputBackground)',
                        border: '0.5px solid',
                        borderColor: 'var(--vscode-focusBorder)',
                        color: 'var(--vscode-settings-textInputForeground)'
                        }}
                        />
                        <Button
                            style = {{ margin: '20px 10px 20px 10px' }}
                            className='button'
                            size='medium'
                            disabled={inProgress}
                            variant='outlined'
                            onClick={handleRequestVerificationCode}>Send Verification Code { inProgress && <ShowProgress size={10}/>}</Button>
                    </div>
                )}
            </>
        )
    }

    const EnterVerificationCode = () => {
        const [verificationCode, setVerificationCode] = React.useState('');

        const [inProgress, setInProgress] = React.useState(false);

        const handleVerifyCode = (event) => {
            setVerificationCode(event.target.value);
        }

        const handleCheckVerificationCode = () => {
            setInProgress(true);
            postMessage('sandboxValidateVerificationCode', {verificationCode});
        }

        const handlRequesteNewCodeRequest = () => {
            setCurrentState({
                action: 'sandboxPageRequestVerificationCode',
                statusInfo: '',
                consoleDashboard: '',
                apiEndpoint: '',
                oauthTokenEndpoint: '',
                errorCode: undefined
            });
        }

        return (
            <>
                {( currentState.action === 'sandboxPageEnterVerificationCode' ) && (
                    <div style={{ margin: '20px', position: 'relative' }}>
                        <CodeTextField id='code'
                            disabled={inProgress}
                            onChange={handleVerifyCode}
                            label='Verification Code'
                            variant='outlined'
                            size='small'
                        />
                        <Button
                            style = {{ margin: '20px 10px 20px 20px' }}
                            className='button'
                            size='medium'
                            disabled={inProgress}
                            variant='outlined'
                            onClick={handleCheckVerificationCode}>
                                Verify { inProgress && <ShowProgress size={10}/>}
                        </Button>
                        <Button
                            style = {{ margin: '20px 0px 20px 10px' }}
                            className='buttonSecondary'
                            size='medium'
                            variant='outlined'
                            onClick={ handlRequesteNewCodeRequest }>
                                Request New Code
                        </Button>
                    </div>
                )}
            </>
        )
    }

    const WaitingForApproval = () => {
        React.useEffect(() => {
            if (currentState.action === 'sandboxPageWaitingForApproval') {
                setTimeout(()=>postMessage('sandboxDetectStatus'), 1000);
            }
        }, []);
        return (
            <>
                {( currentState.action === 'sandboxPageWaitingForApproval' ) && (
                    <div style = {{ margin: '20px' }}>
                        <ShowProgress size={20}/>
                        <Typography component='p'>Waiting for Sandbox instance approval</Typography>
                    </div>
                )}
            </>
        )
    }

    const WaitingForProvision = () => {
        React.useEffect(() => {
            if (currentState.action === 'sandboxPageWaitingForProvision') {
                setTimeout(()=>postMessage('sandboxDetectStatus'), 1000);
            }
        }, []);
        return (
            <>
                {( currentState.action === 'sandboxPageWaitingForProvision' ) && (
                    <div style = {{ margin: '20px'}}>
                        <ShowProgress size={20}/>
                        <Typography component='p'>Sandbox instance has been approved, waiting for provision to finish</Typography>
                    </div>
                )}
            </>
        )
    }

    const Provisioned = () => {

        const handleLoginButton = () => {
            postMessage('sandboxLoginUsingDataInClipboard', {apiEndpointUrl: currentState.apiEndpoint, oauthRequestTokenUrl: `${currentState.oauthTokenEndpoint}/request`});
        };

        return (
            <>
                {( currentState.action === 'sandboxPageProvisioned' ) && (
                    <div style={{ margin: '20px'}}>
                        <Typography variant='body1' component='p' style={{ padding: 20, margin: 0 }}>
                            <Tooltip title={currentState.statusInfo}>
                                    <IconButton
                                        size='large'
                                        aria-label='account of current user'
                                        aria-controls='menu-appbar'
                                        aria-haspopup='true'
                                        color='inherit'
                                    >
                                        <AccountCircle />
                                    </IconButton>
                                </Tooltip>
                            Your sandbox account has been provisioned and is ready to use.
                        </Typography>
                        <Typography variant='caption' display='block' style={{ textAlign:'left', margin: '20px 70px' }}>
                            Next steps to connect with Developer Sandbox:<br></br>
                            1. Click on <strong>Get token</strong> button. In the browser, login using <strong>DevSandbox</strong> button.<br></br>
                            2. Click on <strong>Display token</strong> link and copy token to clipboard.<br></br>
                            3. Switch back to IDE and press <strong>'Login To DevSandbox'</strong> button. This will login you to DevSandbox with token from clipboard.<br></br>
                            4. Once successfully logged in, start creating applications and deploy on cluster.
                        </Typography>
                        <Tooltip title='Launch your DevSandbox console in browser' placement='bottom'>
                            <Button variant='contained' className='button' href={currentState.consoleDashboard}>Open Dashboard</Button>
                        </Tooltip>
                        <Tooltip title='Copy token from DevSandbox console page in browser' placement='bottom'>
                            <Button variant='contained' className='button' href={`${currentState.oauthTokenEndpoint}/request`}>Get token</Button>
                        </Tooltip>
                        <Tooltip title='Login to DevSandbox OpenShift cluster with token from clipboard' placement='bottom'>
                            <Button variant='contained' className='buttonSecondary' onClick={handleLoginButton}>Login to DevSandbox</Button>
                        </Tooltip>
                    </div>
                )}
            </>
        )
    }

    return (
        <>
        <ThemeProvider theme={ClusterViewTheme}>
            <DetectAuthSession />
            <Login />
            <DetectStatus />
            <Signup />
            <RequestVerificationCode />
            <EnterVerificationCode />
            <WaitingForApproval />
            <WaitingForProvision />
            <Provisioned />
        </ThemeProvider>
        </>
    )
}
