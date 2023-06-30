import { Alert, AlertTitle } from "@mui/material";
import * as React from "react";


export function DevfileExplanation() {
    return (
        <Alert severity='info'>
            <AlertTitle>Devfile</AlertTitle>
            A YAML file that contains information on how to deploy your component to OpenShift,
            based on the language or framework that the project uses.
        </Alert>
    );
}