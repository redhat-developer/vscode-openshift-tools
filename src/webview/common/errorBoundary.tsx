/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { ErrorPage } from './errorPage';

type ErrorBoundaryState = {
    hasError: boolean;
};

type ErrorBoundaryProps = {
    webviewName: string;
};

/**
 * Used to capture rendering errors in React code, then send telemetry related.
 *
 * See https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);

        this.state = {
            hasError: false,
        };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        // log as telemetry
        window.vscodeApi.postMessage({
            action: 'sendTelemetry',
            data: {
                actionName: 'webviewRenderError',
                properties: {
                    webviewName: this.props.webviewName,
                    error: JSON.stringify(error),
                    stackTrace: JSON.stringify(info.componentStack),
                },
            },
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <ErrorPage
                    message={`Webview ${this.props.webviewName} encountered an error preventing it from being displayed`}
                />
            );
        }

        return this.props.children;
    }
}
