import { Button, Divider, FormControl, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import { makeStyles } from '@mui/styles';
import * as React from 'react';
import { WorkspaceFolder } from 'vscode';
import createComponentStyle from "../../common/createComponent.style";
import { Devfile } from '../../common/devfile';
import { DevfileListItem } from '../../common/devfileListItem';
import { DevfileRecommendationInfo } from '../../common/devfileRecommendationInfo';

const useCreateComponentStyles = makeStyles(createComponentStyle);

type Message = {
    action: string;
    data: any;
}

export function FromLocalCodebase({ setCurrentView }) {
    const createComponentStyle = useCreateComponentStyles();

    const [workspaceFolders, setWorkspaceFolders] = React.useState<WorkspaceFolder[]>([]);
    const [componentName, setComponentName] = React.useState('');
    const [projectFolder, setProjectFolder] = React.useState('');
    //const [recommendedDevfile, setRecommendedDevfile] = React.useState<Devfile>();
    const [showRecommendedDevfile, setShowRecommendedDevfile] = React.useState(false);
    const [isComponentNameInvalid, setIsComponentNameInvalid] = React.useState(true);
    const [validationMessage, setValidationMessage] = React.useState('Please enter a component name.');

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'workspaceFolders': {
                setWorkspaceFolders(_workspaceFolders => message.data);
                break;
            }
            //case 'recommendedDevfile': {
            //setRecommendedDevfile(_recommendedDevfile => message.data);
            // }
            case 'validatedComponentName': {
                if (message.data) {
                    setIsComponentNameInvalid(true);
                    setValidationMessage(message.data);
                } else {
                    setIsComponentNameInvalid(false);
                }
                break;
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
        window.vscodeApi.postMessage({
            action: 'getRecommendedDevfile',
            param: projectFolder
        });
        setShowRecommendedDevfile(true);
    };

    function handleSelectFolder() {
        // nothing
    }

    return (
        <>
            <div className={createComponentStyle.headerContainer}>
                <Typography variant='h5'>
                    From Existing Local Codebase
                </Typography>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginTop: '2em' }}>
                    <TextField
                        id='componentName'
                        variant='outlined'
                        label='Component Name'
                        error={isComponentNameInvalid}
                        helperText={isComponentNameInvalid && validationMessage}
                        onChange={(e) => {
                            window.vscodeApi.postMessage({
                                action: 'validateComponentName',
                                data: e.target.value
                            });
                            setComponentName(e.target.value);
                        }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '1em', marginTop: '1em' }}>
                    <FormControl fullWidth>
                        <InputLabel id="project-path-label">Folder</InputLabel>
                        <Select
                            className='selectFolder'
                            labelId="project-path-label"
                            value={projectFolder}
                            label="Folder"
                            onChange={(e) => { setProjectFolder(e.target.value as string) }}
                            sx={{ width: '100%' }} >
                            {workspaceFolders.map((folderPath) => (
                                <MenuItem key={folderPath.uri.path} value={folderPath.uri.path}>
                                    {folderPath.uri.path}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Button variant='contained' onClick={handleSelectFolder} sx={{ height: '4em', width: '10%' }} > SELECT FOLDER </Button>
                </div>
                {!showRecommendedDevfile ? (
                    <div style={{ display: 'flex', flexDirection: 'row', gap: '1em', marginTop: '1em' }}>
                        <Button variant='text' onClick={() => { setCurrentView('home') }}>
                            BACK
                        </Button>
                        <Button variant='contained' disabled={isComponentNameInvalid || projectFolder.length === 0} onClick={handleNext}>
                            NEXT
                        </Button>
                    </div>
                ) : (
                    <div>
                        <Divider variant="middle" sx={{ marginTop: '2em' }} />
                        <RecommendedDevfile recommendedDevfile={dummyDevfile} componentName={componentName} setCurrentView={setCurrentView} setShowRecommendedDevfile={setShowRecommendedDevfile} />
                    </div>
                )}
            </div>
        </>
    );
}

type RecommendedDevfileProps = {
    recommendedDevfile: Devfile;
    setCurrentView: any;
    setShowRecommendedDevfile: any;
    componentName: string;
};

function RecommendedDevfile(props: RecommendedDevfileProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', marginTop: '1.5em', justifyContent: 'space-between' }}>
                <Typography variant='h6'>
                    Recommended Devfile
                </Typography>
                <DevfileRecommendationInfo />
            </div>
            <DevfileListItem devfile={props.recommendedDevfile} />
            <div style={{ display: 'flex', gap: '1em', marginTop: '1.5em', justifyContent: 'flex-end' }}>
                <Button variant='text' onClick={() => { props.setShowRecommendedDevfile(false) }} sx={{ marginRight: 'auto' }}>
                    BACK
                </Button>
                <Button variant='text' onClick={() => { props.setCurrentView('devfileSearch') }}>
                    SELECT A DIFFERENT DEVFILE
                </Button>
                <Button variant='contained' onClick={() => {
                    window.vscodeApi.postMessage({
                        action: 'createComponentTest',
                        param: props.componentName
                    });
                }}>
                    CREATE COMPONENT
                </Button>
            </div >
        </div >
    );
}


const dummyDevfile: Devfile = {
    name: 'Go Runtime',
    description:
        'Go (version 1.18.x) is an open source programming language that makes it easy to build simple, reliable, and efficient software. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.',
    supportsDebug: true,
    supportsDeploy: false,
    tags: ['Go', 'Hugo'],
    logoUrl:
        'https://raw.githubusercontent.com/devfile-samples/devfile-stack-icons/main/golang.svg',
    sampleProjects: ['hugo-sample', 'go-backend-sample'],
    yaml: `schemaVersion: 2.1.0
metadata:
name: go
displayName: Go Runtime
description: Go (version 1.18.x) is an open source programming language that makes it easy to build simple, reliable, and efficient software.
icon: https://raw.githubusercontent.com/devfile-samples/devfile-stack-icons/main/golang.svg
tags:
- Go
projectType: Go
language: Go
provider: Red Hat
version: 1.0.2
starterProjects:
- name: go-starter
description: A Go project with a simple HTTP server
git:
  checkoutFrom:
    revision: main
  remotes:
    origin: https://github.com/devfile-samples/devfile-stack-go.git
components:
- container:
  endpoints:
    - name: http-go
      targetPort: 8080
  image: registry.access.redhat.com/ubi9/go-toolset:1.18.10-4
  args: ["tail", "-f", "/dev/null"]
  memoryLimit: 1024Mi
  mountSources: true
name: runtime
commands:
- exec:
  env:
    - name: GOPATH
      value: \${PROJECT_SOURCE}/.go
    - name: GOCACHE
      value: \${PROJECT_SOURCE}/.cache
  commandLine: go build main.go
  component: runtime
  group:
    isDefault: true
    kind: build
  workingDir: \${PROJECT_SOURCE}
id: build
- exec:
  commandLine: ./main
  component: runtime
  group:
    isDefault: true
    kind: run
  workingDir: \${PROJECT_SOURCE}
id: run
    `,
};
