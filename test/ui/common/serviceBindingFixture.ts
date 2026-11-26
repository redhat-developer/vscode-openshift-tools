/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { execFileSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { parse, stringify } from 'yaml';
import { getKubeConfigPath } from './kubeConfigUtils';

export const FIXTURE_SERVICE = {
    kind: 'UiBindingService',
    group: 'tools.openshift-toolkit.dev',
    version: 'v1',
    plural: 'uibindingservices',
    name: 'ui-binding-service',
    secretName: 'ui-binding-secret',
};

/**
 * Returns the namespace of the current kubeconfig context — the active
 * project the extension operates in.
 */
export function getCurrentNamespace(): string {
    const kube = parse(fs.readFileSync(getKubeConfigPath(), 'utf-8')) as { [key: string]: any };
    const context = (kube.contexts ?? []).find((candidate) => candidate.name === kube['current-context']);
    return context?.context?.namespace ?? 'default';
}

function kubectl(args: string[], options: { input?: string } = {}): string {
    return execFileSync('kubectl', args, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        ...options,
    });
}

/**
 * Installs the bindable-service test fixture in the current namespace:
 * a Secret, a custom resource exposing it through `.status.binding.name`,
 * and the CRD backing it (cluster-scoped, created only when absent).
 */
export function installServiceBindingFixture(): void {
    const namespace = getCurrentNamespace();
    const crdPath = path.join(__dirname, '..', '..', 'fixtures', 'servicebinding', 'uibindingservice-crd.yaml');

    kubectl(['apply', '-f', crdPath]);
    kubectl(['wait', '--for=condition=Established', `crd/${FIXTURE_SERVICE.plural}.${FIXTURE_SERVICE.group}`, '--timeout=60s']);

    kubectl(['apply', '-f', '-'], {
        input: stringify({
            apiVersion: 'v1',
            kind: 'Secret',
            metadata: { name: FIXTURE_SERVICE.secretName, namespace },
            type: 'Opaque',
            stringData: { type: 'ui-fixture' },
        }),
    });

    // the CRD declares no status subresource, so status is settable at creation
    kubectl(['apply', '-f', '-'], {
        input: stringify({
            apiVersion: `${FIXTURE_SERVICE.group}/${FIXTURE_SERVICE.version}`,
            kind: FIXTURE_SERVICE.kind,
            metadata: { name: FIXTURE_SERVICE.name, namespace },
            spec: {},
            status: { binding: { name: FIXTURE_SERVICE.secretName } },
        }),
    });
}

/**
 * Removes the bindable-service test fixture: the custom resource and Secret
 * in the current namespace, and the fixture CRD (cluster-scoped).
 */
export function removeServiceBindingFixture(): void {
    const namespace = getCurrentNamespace();

    const ignoreMissing = ['-n', namespace];
    try {
        kubectl([...ignoreMissing, 'delete', `${FIXTURE_SERVICE.plural}.${FIXTURE_SERVICE.group}`, FIXTURE_SERVICE.name, '--ignore-not-found']);
    } catch { /* already deleted */ }
    try {
        kubectl([...ignoreMissing, 'delete', 'secret', FIXTURE_SERVICE.secretName, '--ignore-not-found']);
    } catch { /* already deleted */ }
    try {
        kubectl(['delete', `crd/${FIXTURE_SERVICE.plural}.${FIXTURE_SERVICE.group}`, '--ignore-not-found']);
    } catch { /* already deleted */ }
}
