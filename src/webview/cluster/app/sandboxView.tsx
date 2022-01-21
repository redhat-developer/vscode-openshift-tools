/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Button, CircularProgress, TextField } from '@material-ui/core';
import LoadingButton from '@mui/lab/LoadingButton';
import * as React from 'react';
import SendIcon from '@mui/icons-material/Send';
// import * as ClusterViewStyles from './clusterView.style';

export default function addSandboxView(props): JSX.Element {

    const [currentState, setCurrentState] = React.useState(
        {action: 'detectAuthSession', errorCode: undefined});

    const messageListener = (event) => {
        if (event?.data?.action) {
            // switch (event.data.action) {
            //     case 'sandboxPageLoginRequired':
            //     case 'sandboxPageDetectStatus':
            //     case 'sandboxPageRequestSignup':
            //     case 'sandboxPageRequestVerificationCode':
            //     case 'sandboxPageEnterVerificationCode':
            //     case 'sandboxPageWaitingForApproval':
            //     case 'sandboxPageWaitingForProvision':
            //     case 'sandboxPageProvisioned':
                    setCurrentState(event.data);
            //         break;
            // }
        }
    }

    window.addEventListener('message', messageListener);

    function postMessage(action: string, payload?: any): void {
        window.vscodeApi.postMessage({ action, payload });
    }

    React.useEffect(() => {
        postMessage('sandboxPageCheckAuthSession');
    }, []);
    
    const DetectAuthSession = () => {
        return (
            <>
                {(currentState.action === 'detectAuthSession') && (
                    <div>
                        <CircularProgress color="secondary" /> Detecting Authentication Session
                    </div>
                )}
            </>
        );
    };

    const Login = () => {

        const [inProgress, setInProgress] = React.useState(false)

        const handleLoginButton = () => {
            setInProgress(true);
            postMessage('sandboxPageLoginRequest');
        }
    
        return (
            <>
                {( currentState.action === 'sandboxPageLoginRequired' ) && (
                    <div>
                        <div>You need RedHat Developers account to use Sandbox. Sign up for account if you don't have one or login to developers.redhat.com to continue.</div>
                        {(currentState.errorCode === 'loginTimedOut') && (
                            <div>Login command timed out. Please try again.</div>
                        )}
                        <Button href='https://www.redhat.com/en/program-developers'>Sign up</Button> 
                        <LoadingButton 
                            disabled={inProgress}
                            loadingPosition='start'
                            startIcon={<SendIcon/>}
                            loading={inProgress}
                            variant='contained' 
                            onClick={ handleLoginButton }>
                            Login
                        </LoadingButton>
                    </div>
                )}
            </>
        )
    };

    const DetectStatus = () => {
        
        React.useEffect(() => {
            if (currentState.action === 'sandboxPageDetectStatus') {
                postMessage('sandboxDetectStatus');
            }
        }, []);
        
        return (
            <>
                {( currentState.action === 'sandboxPageDetectStatus' ) && (
                    <div>
                        <CircularProgress color="secondary" /> Detecting Sandbox instance status
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
                    <div>
                        You have not signed up for OpenShif Sandbox. Press 'Sign Up' button below to requtst OpenShitf Sandbox instance.<br/>
                        <LoadingButton 
                            disabled={inProgress}
                            loadingPosition='start'
                            startIcon={<SendIcon/>}
                            loading={inProgress}
                            variant='contained' 
                            onClick={handleSignupButton}>Sign Up for OpenShift Sandbox</LoadingButton>
                    </div>
                )}
            </>
        )
    };

    const RequestVerificationCode = () => {
    
        const [phoneNumber, setPhoneNumber] = React.useState('');
        const [countryCode, setCountryCode] = React.useState('');

        const handlePhoneNumber = (event) => {
            setPhoneNumber(event.target.value);
        }

        const handleCountryCode = (event) => {
            setCountryCode(event.target.value);
        }

        const [inProgress, setInProgress] = React.useState(false)

        const handleRequestVerificationCode = () => {
            setInProgress(true);
            postMessage('sandboxRequestVerificationCode', { phoneNumber, countryCode });
        }

        return (
            <>
                {( currentState.action === 'sandboxPageRequestVerificationCode' ) && (
                    <div>
                            <TextField id='countryCode' disabled={inProgress} onChange={handleCountryCode} label='Country code' variant='outlined' />
                            <TextField id='phoneNumber' disabled={inProgress} onChange={handlePhoneNumber} label='Phone number' variant='outlined' />
                            <LoadingButton disabled={inProgress} loadingPosition='start' startIcon={<SendIcon/>} loading={inProgress} variant='contained' onClick={handleRequestVerificationCode}>Send Verification Code</LoadingButton>
                    </div>
                )}
            </>
        )
    }

    const EnterVerificationCode = () => {
        const [verificationCode, setVerificationCode] = React.useState('');

        const [inProgress, setInProgress] = React.useState(false)

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
                errorCode: undefined
            });
        }

        return (
            <>
                {( currentState.action === 'sandboxPageEnterVerificationCode' ) && (
                    <div>
                        <TextField id='code'
                            disabled={inProgress}
                            onChange={handleVerifyCode}
                            label='Verification Code'
                            variant='outlined'
                        />
                        <LoadingButton 
                            disabled={inProgress}
                            loadingPosition='start'
                            startIcon={<SendIcon/>}
                            loading={inProgress}
                            variant='contained'
                            onClick={handleCheckVerificationCode}>
                                Verify
                            </LoadingButton>
                            <LoadingButton variant='contained' onClick={ handlRequesteNewCodeRequest }>Request New Code</LoadingButton>
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
                    <div>
                        <CircularProgress color="secondary" /> Waiting for Sandbox instance approval
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
                    <div>
                        <CircularProgress color="secondary" /> Sandbox instance has been approved, waiting for provision to finish
                    </div>
                )}
            </>
        )
    }

    const Provisioned = () => {
        return (
            <>
                {( currentState.action === 'sandboxPageProvisioned' ) && (
                    <div>
                        <p>Sandbox instance has been provisioned.</p>
                        <Button variant='contained'>Open Developer Console</Button><Button variant='contained'>Login with token from clipboard</Button>
                    </div>
                )}
            </>
        )
    }

    return (
        <>
            <DetectAuthSession />
            <Login />
            <DetectStatus />
            <Signup />
            <RequestVerificationCode />
            <EnterVerificationCode />
            <WaitingForApproval />
            <WaitingForProvision />
            <Provisioned />
        </>
    )
}