/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { getRedHatService, TelemetryEvent, TelemetryService } from '@redhat-developer/vscode-redhat-telemetry';
import { ExtensionContext } from 'vscode';

let telemetryService: TelemetryService;

export function createTrackingEvent(name: string, properties: any = {}): TelemetryEvent {
    return {
        type: 'track',
        name,
        properties
    }
}

export async function startTelemetry(context: ExtensionContext): Promise<void> {
    const redHatService = await getRedHatService(context);
    telemetryService = await redHatService.getTelemetryService();
    return telemetryService.sendStartupEvent();
}

export default async function sendTelemetry(actionName: string, properties?: any): Promise<void> {
    if (!telemetryService) {
        throw Error('Telemetry service has not been started yet!');
    }
    return telemetryService.send(createTrackingEvent(actionName, properties));
}

export interface CommonCommandProps {
    identifier: string;
    error: string;
    'stack_trace': string;
    duration: number;
    cancelled: boolean;
}

export interface NewComponentCommandProps {
    'component_kind': string;
    'component_type': string;
    'component_version': string;
    'starter_project': string;
    'use_existing_devfile': boolean;
}

export type AllProps = Partial<CommonCommandProps & NewComponentCommandProps>;