/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorPage } from './errorPage';

/**
 * Initialize react-error-boundary with defaults for webviews.
 */
export function WebviewErrorBoundary(props: { webviewName: string; children }) {
    return (
        <ErrorBoundary
            fallback={
                <ErrorPage
                    message={`Webview ${props.webviewName} encountered an error preventing it from being displayed`}
                />
            }
            onError={(error, info) => {
                void window.vscodeApi.postMessage({
                    action: 'sendTelemetry',
                    data: {
                        actionName: 'webviewRenderError',
                        properties: {
                            webviewName: props.webviewName,
                            error: JSON.stringify(error),
                            stackTrace: JSON.stringify(info.componentStack),
                        },
                    },
                });
            }}
            children={props.children}
        ></ErrorBoundary>
    );
}
