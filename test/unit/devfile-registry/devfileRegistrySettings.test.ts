/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ConfigurationTarget, WorkspaceConfiguration, workspace } from 'vscode';
import { DevfileRegistryInfo } from '../../../src/devfile-registry/devfileInfo';
import { DevfileRegistrySettings } from '../../../src/devfile-registry/devfileRegistrySettings';

const { expect } = chai;
chai.use(sinonChai);

const ODO_PREFERENCE_YAML = `kind: Preference
apiversion: odo.dev/v1alpha1
OdoSettings:
  RegistryList:
    - Name: DefaultDevfileRegistry
      URL: https://registry.devfile.io
      secure: false
    - Name: MyRegistry
      URL: https://example.org
      secure: true
`;

suite('Devfile/RegistrySettings', () => {
    let sandbox: sinon.SinonSandbox;
    let settings: DevfileRegistrySettings;
    let configGetStub: sinon.SinonStub;
    let configInspectStub: sinon.SinonStub;
    let configUpdateStub: sinon.SinonStub;
    let homeDir: string;

    function stubConfiguration(registries: DevfileRegistryInfo[] | undefined, hasUserValue = false): void {
        configGetStub.returns(registries);
        configInspectStub.returns(hasUserValue ? { globalValue: registries } : { globalValue: undefined });
    }

    setup(async () => {
        sandbox = sinon.createSandbox();
        settings = new DevfileRegistrySettings();

        configGetStub = sandbox.stub();
        configInspectStub = sandbox.stub();
        configUpdateStub = sandbox.stub().resolves();
        const fakeConfig = {
            get: configGetStub,
            inspect: configInspectStub,
            update: configUpdateStub
        };
        sandbox.stub(workspace, 'getConfiguration').returns(fakeConfig as unknown as WorkspaceConfiguration);

        homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'devfile-registry-settings-test-'));
        await fs.mkdir(path.join(homeDir, '.odo'), { recursive: true });
        process.env.CUSTOM_HOMEDIR = homeDir;
    });

    teardown(async () => {
        sandbox.restore();
        delete process.env.CUSTOM_HOMEDIR;
        await fs.rm(homeDir, { recursive: true, force: true }).catch(() => { /* ignore */ });
    });

    suite('getRegistries()', () => {
        test('returns the default registry when the setting is unset', async () => {
            stubConfiguration(undefined);
            const registries = await settings.getRegistries();
            expect(registries).deep.equals([{
                name: DevfileRegistrySettings.DEFAULT_DEVFILE_REGISTRY_NAME,
                url: DevfileRegistrySettings.DEFAULT_DEVFILE_REGISTRY_URL,
                secure: DevfileRegistrySettings.DEFAULT_DEVFILE_REGISTRY_SECURE
            }]);
        });

        test('returns the configured registries', async () => {
            const configured: DevfileRegistryInfo[] = [{ name: 'Custom', url: 'https://example.org', secure: true }];
            stubConfiguration(configured);
            const registries = await settings.getRegistries();
            expect(registries).deep.equals(configured);
        });
    });

    suite('addRegistry()', () => {
        test('prepends the registry and saves it to the global settings', async () => {
            const existing: DevfileRegistryInfo[] = [{ name: 'Custom', url: 'https://example.org', secure: false }];
            stubConfiguration(existing);

            const added = await settings.addRegistry('NewRegistry', 'https://new.example.org', 'token');

            expect(added).deep.equals({ name: 'NewRegistry', url: 'https://new.example.org', secure: true });
            expect(configUpdateStub).calledOnceWithExactly(
                'devfileRegistries',
                [
                    { name: 'NewRegistry', url: 'https://new.example.org', secure: true },
                    { name: 'Custom', url: 'https://example.org', secure: false }
                ],
                ConfigurationTarget.Global
            );
        });
    });

    suite('removeRegistry()', () => {
        test('removes the registry and saves the settings', async () => {
            stubConfiguration([
                { name: 'Custom', url: 'https://example.org', secure: false },
                { name: 'Other', url: 'https://other.example.org', secure: false }
            ]);

            await settings.removeRegistry('Custom');

            expect(configUpdateStub).calledOnceWithExactly(
                'devfileRegistries',
                [{ name: 'Other', url: 'https://other.example.org', secure: false }],
                ConfigurationTarget.Global
            );
        });

        test('does nothing for an unknown registry name', async () => {
            stubConfiguration([{ name: 'Custom', url: 'https://example.org', secure: false }]);

            await settings.removeRegistry('Unknown');

            expect(configUpdateStub).not.called;
        });
    });

    suite('resolveRegistryUrl()', () => {
        test('returns the default registry URL without arguments', async () => {
            stubConfiguration(undefined);
            const url = await settings.resolveRegistryUrl();
            expect(url).equals(DevfileRegistrySettings.DEFAULT_DEVFILE_REGISTRY_URL);
        });

        test('resolves the URL of a named registry', async () => {
            stubConfiguration([{ name: 'Custom', url: 'https://example.org', secure: false }]);
            const url = await settings.resolveRegistryUrl('Custom');
            expect(url).equals('https://example.org');
        });

        test('throws for an unknown registry name', async () => {
            stubConfiguration([]);
            try {
                await settings.resolveRegistryUrl('Unknown');
                expect.fail();
            } catch (err) {
                expect((err as Error).message).equals('Unknown registry name: Unknown');
            }
        });
    });

    suite('migrateFromOdoPreference()', () => {
        test('seeds the setting from the odo preference file', async () => {
            await fs.writeFile(path.join(homeDir, '.odo', 'preference.yaml'), ODO_PREFERENCE_YAML, 'utf-8');
            stubConfiguration(undefined);

            await settings.migrateFromOdoPreference();

            expect(configUpdateStub).calledOnceWithExactly(
                'devfileRegistries',
                [
                    { name: 'DefaultDevfileRegistry', url: 'https://registry.devfile.io', secure: false },
                    { name: 'MyRegistry', url: 'https://example.org', secure: true }
                ],
                ConfigurationTarget.Global
            );
        });

        test('does nothing when the setting already has a user value', async () => {
            await fs.writeFile(path.join(homeDir, '.odo', 'preference.yaml'), ODO_PREFERENCE_YAML, 'utf-8');
            stubConfiguration([{ name: 'Custom', url: 'https://example.org', secure: false }], true);

            await settings.migrateFromOdoPreference();

            expect(configUpdateStub).not.called;
        });

        test('does nothing when no odo preference file exists', async () => {
            stubConfiguration(undefined);

            await settings.migrateFromOdoPreference();

            expect(configUpdateStub).not.called;
        });
    });
});
