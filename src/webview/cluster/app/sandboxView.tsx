/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Button, CircularProgress, TextField } from '@material-ui/core';
import LoadingButton from '@mui/lab/LoadingButton';
import * as React from 'react';
import SendIcon from '@mui/icons-material/Send';

// import * as request from 'request';

export default function addSandboxView(props): JSX.Element {

    const [currentState, setCurrentState] = React.useState('detectAuthSession');

    const messageListener = (event) => {
        if (event?.data?.action) {
            switch (event.data.action) {
                case 'sandboxPageLoginRequired':
                case 'sandboxPageDetectStatus':
                case 'sandboxRequestVerificationCode':
                case 'sandboxEnterVerificationCode':
                case 'sandboxWaitingForApproval':
                case 'sandboxWaitingForProvision':
                case 'sandboxProvisioned':
                    setCurrentState(event.data.action);
                    break;
            }
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
                {(currentState === 'detectAuthSession') && (
                    <div>
                        <CircularProgress color="secondary" /> Detecting Authentication Session
                    </div>
                )}
            </>
        );
    };

    const Login = () => {

        const handleLoginButton = () => {
            postMessage('sandboxPageLoginRequest')
        }
    
        return (
            <>
                {( currentState === 'sandboxPageLoginRequired' ) && (
                    <div>
                        You need RedHat Developers account to use Sandbox. <Button href='https://www.redhat.com/en/program-developers'>Sign up</Button>, if you don't have one.
                        Login to developers.redhat.com and continue
                        <Button onClick={ handleLoginButton }>Login</Button>
                    </div>
                )}
            </>
        )
    };

    const DetectStatus = () => {
        return (
            <>
                {( currentState === 'sandboxPageDetectStatus' ) && (
                    <div>
                        <CircularProgress color="secondary" /> Detecting Sandbox instance status
                    </div>
                )}
            </>
        )
    };

    const RequestVerificationCode = () => {
    
        const [phoneNumber, setPhoneNumber] = React.useState('');

        const handlePhoneNumber = (event) => {
            setPhoneNumber(event.target.value);
        }

        const [inProgress, setInProgress] = React.useState(false)

        const handleRequestVerificationCode = () => {
            setInProgress(true);
            postMessage('sandboxRequestVerificationCode', { phoneNumber })
        }

        return (
            <>
                {( currentState === 'sandboxRequestVerificationCode' ) && (
                    <div>
                         <TextField id='phone' onChange={handlePhoneNumber} label='Phone number' variant='outlined' />
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
            postMessage('sandboxCheckVerificationCode', {verificationCode});
        }

        return (
            <>
                {( currentState === 'sandboxEnterVerificationCode' ) && (
                    <div>
                        <TextField id='code' onChange={handleVerifyCode} label='Verification Code' variant='outlined' /> <LoadingButton disabled={inProgress} loadingPosition='start' startIcon={<SendIcon/>} loading={inProgress} variant='contained' onClick={handleCheckVerificationCode}>Verify</LoadingButton>
                    </div>
                )}
            </>
        )
    }

    const WaitingForApproval = () => {
        return (
            <>
                {( currentState === 'sandboxWaitingForApproval' ) && (
                    <div>
                        <CircularProgress color="secondary" /> Waiting for Sandbox instance approval
                    </div>
                )}
            </>
        )
    }

    const WaitingForProvision = () => {
        return (
            <>
                {( currentState === 'sandboxWaitingForProvision' ) && (
                    <div>
                        <CircularProgress color="secondary" /> Sandbox instance has been approved, waiting for provision
                    </div>
                )}
            </>
        )
    }

    const Provisioned = () => {
        return (
            <>
                {( currentState === 'sandboxProvisioned' ) && (
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
            <RequestVerificationCode />
            <EnterVerificationCode />
            <WaitingForApproval />
            <WaitingForProvision />
            <Provisioned />
        </>
    )
}