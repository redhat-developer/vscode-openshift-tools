import { Button, MenuItem, TextField, Typography } from '@mui/material';
import { makeStyles } from '@mui/styles';
import * as React from 'react';
import createComponentStyle from "../../common/createComponent.style";
import { WorkspaceFolder } from 'vscode';

const useCreateComponentStyles = makeStyles(createComponentStyle);

type Message = {
    action: string;
    data: any;
}

export function FromLocalCodebase({ setCurrentView }) {
    const createComponentStyle = useCreateComponentStyles();
    const [workspaceFolders, setWorkspaceFolders] = React.useState<WorkspaceFolder[]>([]);

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'workspaceFolders': {
                setWorkspaceFolders(_workspaceFolders => message.data);
            }
        }
    }

    React.useEffect(() => {
        window.addEventListener('message', respondToMessage);
        return () => {
            window.removeEventListener('message', respondToMessage);
        };
    }, []);

    React.useEffect(() => {
        window.vscodeApi.postMessage({ action: 'getWorkspaceFolders' });
    }, [])

    function handleNext() {
        // nothing
    };

    function handleSelectFolder() {
        // nothing
    };

    return (
        <>
            <div className={createComponentStyle.headerContainer}>
                <Typography variant='h5'>
                    From Existing Local Codebase
                </Typography>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginTop: '2em' }}>
                    <TextField variant='outlined' label='Component Name' />
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '1em', marginTop: '1.5em' }}>
                    <TextField id='outlined-select' select label='Folder' defaultValue={'test'}
                        helperText='Select project path or browse to upload' sx={{ width: '90%' }}>
                        {workspaceFolders.map((folderPath) => (
                            <MenuItem key={folderPath.uri.path} value={folderPath.uri.path}>
                                {folderPath.uri.path}
                            </MenuItem>
                        ))}
                    </TextField>
                    <Button variant='contained' onClick={handleSelectFolder} sx={{ height: '4em', width: '10%' }} > SELECT FOLDER </Button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '1em', marginTop: '1em' }}>
                    <Button variant='text' onClick={() => {setCurrentView('home')}}>
                        BACK
                    </Button>
                    <Button variant='contained' onClick={handleNext}>
                        NEXT
                    </Button>
                </div>
            </div>
        </>
    );
}
