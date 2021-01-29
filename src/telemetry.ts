/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { getTelemetryService, TelemetryEvent, TelemetryService } from '@redhat-developer/vscode-redhat-telemetry';
import { ExtenisonID } from './util/constants';

const telemetryService: Promise<TelemetryService> = getTelemetryService(ExtenisonID);

export async function getTelemetryServiceInstance(): Promise<TelemetryService> {
    return telemetryService;
}

export function createTrackingEvent(name: string, properties: any = {}): TelemetryEvent {
    return {
        type: 'track',
        name,
        properties
    }
}

export default async function sendTelemetry(actionName: string, properties?: any): Promise<void> {
    const service = await getTelemetryServiceInstance();
    service?.send(createTrackingEvent(actionName, properties));
}