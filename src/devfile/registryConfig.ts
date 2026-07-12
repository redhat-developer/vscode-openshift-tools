/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { QuickPickItem, QuickPickItemKind, ThemeIcon, window, workspace } from 'vscode';
import { CommandText, CommandOption } from '../base/command';
import { CliChannel } from '../cli';
import { ToolsConfig } from '../tools';
import { quickBtn, inputValue } from '../util/inputValue';
import { TokenStore } from '../util/credentialManager';
import { ContainerRuntimeDetector, ContainerRuntime } from '../util/containerRuntime';

export interface RegistryCredentials {
    registry: string;
    username: string;
    password: string;
}

const WELL_KNOWN_REGISTRIES: QuickPickItem[] = [
    { label: 'quay.io', description: 'Red Hat Quay' },
    { label: 'docker.io', description: 'Docker Hub' },
    { label: 'ghcr.io', description: 'GitHub Container Registry' },
];

export const OPENSHIFT_INTERNAL_REGISTRY = 'openshift-internal';

export async function ensureRegistryConfigured(
    runtime: ContainerRuntime,
    isOpenShift = false,
): Promise<RegistryCredentials | null> {
    const config = workspace.getConfiguration('openshiftToolkit');
    let registry = config.get<string>('containerRegistryUrl') || '';
    let username = config.get<string>('containerRegistryUsername') || '';

    enum Step { selectRegistry, enterRegistry, enterUsername, enterPassword }
    let step: Step = Step.selectRegistry;
    let password: string;

    while (step !== undefined) {
        switch (step) {
            case Step.selectRegistry: {
                const result = await selectRegistry(registry, isOpenShift);
                if (result === null) return null;
                if (result === undefined) { step = Step.enterRegistry; break; }
                if (result === OPENSHIFT_INTERNAL_REGISTRY) {
                    return { registry: OPENSHIFT_INTERNAL_REGISTRY, username: '', password: '' };
                }
                registry = result;
                step = Step.enterUsername;
                break;
            }
            case Step.enterRegistry: {
                const validate = (v: string) => {
                    if (!v) return 'Registry URL cannot be empty';
                    if (v.includes(' ')) return 'Registry URL cannot contain spaces';
                    return undefined;
                };
                const result = await inputValue(
                    'Provide container registry URL',
                    registry, false, validate,
                    'e.g. quay.io, registry.example.com',
                );
                if (result === null) return null;
                if (result === undefined) { step = Step.selectRegistry; break; }
                registry = result;
                step = Step.enterUsername;
                break;
            }
            case Step.enterUsername: {
                const validate = (v: string) => !v ? 'Username cannot be empty' : undefined;
                const result = await inputValue(
                    `Provide username for ${registry}`,
                    username, false, validate,
                    `Username for: ${registry}`,
                );
                if (result === null) return null;
                if (result === undefined) { step = Step.selectRegistry; break; }
                username = result;
                step = Step.enterPassword;
                break;
            }
            case Step.enterPassword: {
                const loggedIn = await ContainerRuntimeDetector.isRegistryLoggedIn(runtime, registry);
                if (loggedIn) {
                    await saveRegistrySettings(registry, username);
                    return { registry, username, password: '' };
                }
                const stored = await TokenStore.getItem('registry', `${registry}/${username}`);
                const validate = (v: string) => !v ? 'Password cannot be empty' : undefined;
                const result = await inputValue(
                    `Provide password for ${username}@${registry}`,
                    stored || '', true, validate,
                    `Password for: ${username}@${registry}`,
                );
                if (result === null) return null;
                if (result === undefined) { step = Step.enterUsername; break; }
                password = result;
                step = undefined;
                break;
            }
            default:
                step = undefined;
                break;
        }
    }

    if (!registry || !username || !password) return null;

    await saveRegistrySettings(registry, username);
    await TokenStore.setItem('registry', `${registry}/${username}`, password);

    return { registry, username, password };
}

const INTERNAL_REGISTRY_LABEL = 'OpenShift internal registry (auto-detect)';

async function selectRegistry(currentRegistry: string, isOpenShift = false): Promise<string | null | undefined> {
    return new Promise<string | null | undefined>((resolve) => {
        const addNew: QuickPickItem = { label: '$(plus) Provide new registry URL...' };
        const quickPick = window.createQuickPick();
        quickPick.placeholder = 'Select a container image registry';
        quickPick.ignoreFocusOut = true;

        const items: QuickPickItem[] = [...WELL_KNOWN_REGISTRIES];
        if (currentRegistry && !WELL_KNOWN_REGISTRIES.find(r => r.label === currentRegistry)) {
            items.unshift({ label: currentRegistry, description: 'Previously used' });
        }
        items.push({ label: '', kind: QuickPickItemKind.Separator });
        items.push(addNew);
        if (isOpenShift) {
            items.push({ label: '', kind: QuickPickItemKind.Separator });
            items.push({ label: INTERNAL_REGISTRY_LABEL, description: 'Uses cluster token' });
        }

        quickPick.items = items;
        const cancelBtn = new quickBtn(new ThemeIcon('close'), 'Cancel');
        quickPick.buttons = [cancelBtn];

        let selection: readonly QuickPickItem[] | undefined;
        const hideDisposable = quickPick.onDidHide(() => {
            quickPick.dispose();
            resolve(null);
        });
        quickPick.onDidChangeSelection((selects) => { selection = selects; });
        quickPick.onDidAccept(() => {
            const choice = selection?.[0];
            hideDisposable.dispose();
            quickPick.hide();
            quickPick.dispose();
            if (!choice) { resolve(null); return; }
            if (choice.label === addNew.label) {
                resolve(undefined);
            } else if (choice.label === INTERNAL_REGISTRY_LABEL) {
                resolve(OPENSHIFT_INTERNAL_REGISTRY);
            } else {
                resolve(choice.label);
            }
        });
        quickPick.onDidTriggerButton((button) => {
            hideDisposable.dispose();
            quickPick.hide();
            quickPick.dispose();
            resolve(null);
        });
        quickPick.show();
    });
}

// Global scope (true) — registry account is typically shared across projects
async function saveRegistrySettings(registry: string, username: string): Promise<void> {
    const config = workspace.getConfiguration('openshiftToolkit');
    await config.update('containerRegistryUrl', registry, true);
    await config.update('containerRegistryUsername', username, true);
}

export function rewriteImageName(imageName: string, registry: string, username: string): string {
    if (imageName.includes('/')) return imageName;
    return `${registry}/${username}/${imageName}`;
}

function pullSecretName(registry: string): string {
    return `deploy-pull-${registry.replace(/[^a-z0-9]/g, '-')}`;
}

export async function ensurePullSecret(
    registry: string,
    username: string,
    password: string,
): Promise<boolean> {
    const ocPath = await ToolsConfig.detect('oc');
    if (!ocPath) return false;

    const secretName = pullSecretName(registry);

    // 1. Check if secret already exists
    try {
        const check = await CliChannel.getInstance().executeTool(
            new CommandText('oc', `get secret ${secretName}`),
            undefined, true,
        );
        if (check.stdout) return true;
    } catch {
        // secret doesn't exist — need to create it
    }

    // 2. Resolve password: param → TokenStore → prompt user
    let resolvedPassword = password;
    const tokenKey = `${registry}/${username}`;

    if (!resolvedPassword) {
        resolvedPassword = await TokenStore.getItem('registry', tokenKey) || '';
    }

    if (!resolvedPassword) {
        const validate = (v: string) => !v ? 'Password cannot be empty' : undefined;
        const result = await inputValue(
            `Enter password for ${username}@${registry} to create an image pull secret`,
            '', true, validate,
            `Password for: ${username}@${registry}`,
        );
        if (!result) return false;
        resolvedPassword = result;
        await TokenStore.setItem('registry', tokenKey, resolvedPassword);
    }

    // 3. Create the secret and link to default service account
    try {
        await CliChannel.getInstance().executeTool(
            new CommandText('oc', `create secret docker-registry ${secretName}`, [
                new CommandOption('--docker-server', registry),
                new CommandOption('--docker-username', username),
                new CommandOption('--docker-password', resolvedPassword, true),
            ]),
        );
        await CliChannel.getInstance().executeTool(
            new CommandText('oc', `secrets link default ${secretName}`, [
                new CommandOption('--for', 'pull'),
            ]),
        );
        return true;
    } catch {
        return false;
    }
}
