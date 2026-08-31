/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Disposable, EventEmitter } from 'vscode';
import { OpenShiftTerminalApi } from '../webview/openshift-terminal/openShiftTerminal';

/**
 * Component context state - used for setting/showing context menu items and tree icons.
 */
export enum ComponentContextState {
    DEV = 'dev-nrn',
    DEV_STARTING = 'dev-str',
    DEV_RUNNING = 'dev-run',
    DEV_STOPPING = 'dev-stp',
    DEB = 'deb-nrn',
    DEB_RUNNING = 'deb-run',
    DEP = 'dep-nrn',
    DEP_STARTING = 'dep-str',
    DEP_RUNNING = 'dep-run',
    DEP_STOPPING = 'dep-stp',
}

export interface DevProcessStopRequest extends Disposable {
    isSigabrtSent: () => boolean;
    sendSigabrt: () => void;
}

export interface ComponentDevState {
    // dev state
    devTerminal?: OpenShiftTerminalApi;
    devStatus?: ComponentContextState;
    contextValue?: string;
    devProcessStopRequest?: DevProcessStopRequest;
    // debug state
    debugStatus?: string;
    // deploy state
    deployStatus?: string;
    runOn?: undefined | 'podman';
}

/**
 * In-memory component state map (dev/debug/deploy status, terminals, etc.).
 * Extracted to break the circular dependency: explorer.ts → component.ts → explorer.ts
 */
export const componentStates = new Map<string, ComponentDevState>();

/**
 * Get component state by context path without creating a new one.
 * Returns undefined if no state exists for the given path.
 */
export function getComponentStateByContext(contextPath: string): ComponentDevState | undefined {
    return componentStates.get(contextPath);
}

/**
 * Event emitter for component state changes.
 * Fires with the context path when any component's state changes.
 */
const stateChangedEmitter = new EventEmitter<string>();

/**
 * Subscribe to component state changes.
 */
export function onComponentStateChanged(listener: (context: string) => any): Disposable {
    return stateChangedEmitter.event(listener);
}

/**
 * Fire a component state change event for the given context path.
 */
export function fireComponentStateChanged(contextPath: string): void {
    stateChangedEmitter.fire(contextPath);
}
