/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Theme } from '@mui/material';
import * as React from 'react';
import 'react-dom';
import { DevfileData, DevfileInfo } from '../../devfile-registry/devfileInfo';
import { TemplateProjectIdentifier } from './devfile';
import { DevfileSearch } from './devfileSearch';
import { SetNameAndFolder } from './setNameAndFolder';

type CurrentPage = 'selectTemplateProject' | 'setNameAndFolder';

type FromTemplateProjectProps = {
    titleText: string
    goHome?: () => void;
    theme: Theme;
};

type Message = {
    action: string;
    data: any;
};

export function FromTemplateProject(props: FromTemplateProjectProps) {
    const [currentPage, setCurrentPage] = React.useState<CurrentPage>('selectTemplateProject');
    const [selectedTemplateProject, setSelectedTemplateProject] =
        React.useState<TemplateProjectIdentifier>(undefined);
    const [selectedDevfileInfo, setSelectedDevfileInfo] = React.useState<DevfileInfo>(undefined);
    const [selectedDevfile, setSelectedDevfile] = React.useState<DevfileData>(undefined);
    const [selectedDevfileVersion, setSelectedDevfileVersion] = React.useState<string>(undefined);
    const [initialComponentParentFolder, setInitialComponentParentFolder] = React.useState<string>(undefined);

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'initialWorkspaceFolder': {
                setInitialComponentParentFolder(message.data);
                break;
            }
            case 'devfile': {
                setSelectedDevfile((_devfile) => message.data.devfile);
                break;
            }
            default:
                break;
       }
    }

    React.useEffect(() => {
        window.addEventListener('message', respondToMessage);
        return () => {
            window.removeEventListener('message', respondToMessage);
        };
    }, []);

    React.useEffect(() => {
        window.vscodeApi.postMessage({ action: 'getInitialWokspaceFolder' });
    }, []);

    React.useEffect(() => {
        window.vscodeApi.postMessage({
                action: 'getDevfile',
                data: {
                    devfile: selectedDevfileInfo,
                    version: selectedDevfileVersion
                }
            });
    }, []);

    React.useEffect(() => {
        setSelectedDevfileVersion((_) => selectedDevfileInfo?.versions.find((v) => v.default)?.version);
    }, [selectedDevfileInfo]);

    function setSelectedProjectAndAdvance(value: TemplateProjectIdentifier) {
        value.devfileVersion = selectedDevfileVersion; // Update selected version
        setSelectedTemplateProject((_) => value);
        setCurrentPage((_) => 'setNameAndFolder');
    }

    function createComponent(projectFolder: string, componentName: string, devfileVersion: string, addToWorkspace: boolean, portNumber: number) {
        window.vscodeApi.postMessage({
            action: 'createComponent',
            data: {
                templateProject: selectedTemplateProject,
                projectFolder,
                componentName,
                devfileVersion,
                portNumber,
                isFromTemplateProject: true,
                addToWorkspace
            },
        });
    }

    switch (currentPage) {
        case 'selectTemplateProject':
            return (
                <DevfileSearch
                    setSelectedDevfileInfo={setSelectedDevfileInfo}
                    setSelectedDevfile={setSelectedDevfile}
                    setSelectedTemplateProject={setSelectedProjectAndAdvance}
                    titleText={props.titleText}
                    goBack={props.goHome}
                    theme={props.theme}
                />
            );
        case 'setNameAndFolder':
            return (
                <SetNameAndFolder
                    goBack={() => {
                        setCurrentPage('selectTemplateProject');
                    }}
                    createComponent={createComponent}
                    devfileInfo={selectedDevfileInfo}
                    devfile={selectedDevfile}
                    templateProject={selectedTemplateProject.templateProjectName}
                    initialComponentName={selectedTemplateProject.templateProjectName}
                    initialComponentParentFolder={initialComponentParentFolder}
                />
            );
        default:
            break;
    }
}
