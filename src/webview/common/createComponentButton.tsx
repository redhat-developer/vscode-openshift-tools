/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import ConstructionIcon from '@mui/icons-material/Construction';
import LoadingButton from '@mui/lab/LoadingButton';
import { Alert, AlertTitle } from '@mui/material';
import * as React from 'react';

export type CreateComponentButtonProps = {
    componentName: string;
    componentParentFolder: string;
    isComponentNameFieldValid: boolean;
    isFolderFieldValid: boolean;
    isLoading: boolean;
    createComponent: (projectFolder: string, componentName: string) => void;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
};

export function CreateComponentButton(props: CreateComponentButtonProps) {
    return (
        <LoadingButton
            variant="contained"
            onClick={() => {
                props.createComponent(props.componentParentFolder, props.componentName);
                props.setLoading(true);
            }}
            disabled={!props.isComponentNameFieldValid || !props.isFolderFieldValid || props.isLoading}
            loading={props.isLoading}
            loadingPosition="start"
            startIcon={<ConstructionIcon />}
        >
            <span>Create Component</span>
        </LoadingButton>
    );
}

export function CreateComponentErrorAlert({ createComponentErrorMessage }) {
    return (
        <>
            {createComponentErrorMessage.length !== 0 &&
                <Alert severity="error">
                    <AlertTitle>Create Component Failed:</AlertTitle>
                    {createComponentErrorMessage}
                </Alert>
            }
        </>
    );
}

