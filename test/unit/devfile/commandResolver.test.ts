/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { CommandResolver } from '../../../src/devfile/commandResolver';
import { Data } from '../../../src/devfile/componentTypeDescription';

const { expect } = chai;

function baseDevfile(): Data {
    return {
        schemaVersion: '2.2.0',
        metadata: { name: 'test-component', version: '1.0.0' },
        components: [
            {
                name: 'runtime',
                container: {
                    image: 'my-image:latest',
                    memoryLimit: '512Mi',
                    mountSources: true,
                    volumeMounts: [],
                    endpoints: [],
                    sourceMapping: '/custom-source',
                },
            },
        ],
    };
}

suite('devfile/commandResolver.ts', () => {

    suite('getCommand()', () => {
        test('finds a command by id, case-insensitively', () => {
            const devfile: Data = {
                ...baseDevfile(),
                commands: [{ id: 'Run', exec: { commandLine: 'npm start', component: 'runtime', workingDir: '/projects' } }],
            };

            expect(CommandResolver.getCommand(devfile, 'run')).to.equal(devfile.commands[0]);
        });

        test('throws when the command does not exist', () => {
            const devfile: Data = { ...baseDevfile(), commands: [] };

            expect(() => CommandResolver.getCommand(devfile, 'missing')).to.throw('Command \'missing\' not found');
        });
    });

    suite('getAllCommandsMap()', () => {
        test('maps every command by lowercased id', () => {
            const devfile: Data = {
                ...baseDevfile(),
                commands: [
                    { id: 'Build', exec: { commandLine: 'npm install', component: 'runtime', workingDir: '/projects' } },
                    { id: 'run', exec: { commandLine: 'npm start', component: 'runtime', workingDir: '/projects' } },
                ],
            };

            const map = CommandResolver.getAllCommandsMap(devfile);

            expect(map.get('build')).to.equal(devfile.commands[0]);
            expect(map.get('run')).to.equal(devfile.commands[1]);
        });
    });

    suite('findCommandByGroup()', () => {
        test('finds the command whose exec group matches the requested kind', () => {
            const devfile: Data = {
                ...baseDevfile(),
                commands: [
                    { id: 'build', exec: { commandLine: 'npm install', component: 'runtime', workingDir: '/projects', group: { kind: 'build', isDefault: true } } },
                    { id: 'run', exec: { commandLine: 'npm start', component: 'runtime', workingDir: '/projects', group: { kind: 'run', isDefault: true } } },
                ],
            };

            const found = CommandResolver.findCommandByGroup(devfile, 'run');

            expect(found?.id).to.equal('run');
        });

        test('prefers the command marked isDefault when several share a group', () => {
            const devfile: Data = {
                ...baseDevfile(),
                commands: [
                    { id: 'run-alt', exec: { commandLine: 'npm run alt', component: 'runtime', workingDir: '/projects', group: { kind: 'run', isDefault: false } } },
                    { id: 'run-default', exec: { commandLine: 'npm start', component: 'runtime', workingDir: '/projects', group: { kind: 'run', isDefault: true } } },
                ],
            };

            const found = CommandResolver.findCommandByGroup(devfile, 'run');

            expect(found?.id).to.equal('run-default');
        });

        test('returns undefined when no command matches the group', () => {
            const devfile: Data = { ...baseDevfile(), commands: [] };

            expect(CommandResolver.findCommandByGroup(devfile, 'debug')).to.be.undefined;
        });
    });

    suite('resolveRunCommand()', () => {
        test('resolves container, source mapping, working directory, and command line', () => {
            const devfile: Data = {
                ...baseDevfile(),
                commands: [
                    { id: 'run', exec: { commandLine: 'npm start', component: 'runtime', workingDir: '${PROJECT_SOURCE}', group: { kind: 'run', isDefault: true } } },
                ],
            };

            const resolved = CommandResolver.resolveRunCommand(devfile, 'run');

            expect(resolved.containerName).to.equal('runtime');
            expect(resolved.sourceMapping).to.equal('/custom-source');
            expect(resolved.workingDir).to.equal('/custom-source');
            expect(resolved.commandLine).to.equal('npm start');
            expect(resolved.containerComponent?.name).to.equal('runtime');
            expect(resolved.hotReloadCapable).to.be.false;
        });

        test('carries hotReloadCapable through from the devfile command', () => {
            const devfile: Data = {
                ...baseDevfile(),
                commands: [
                    { id: 'run', exec: { commandLine: 'npm start', component: 'runtime', workingDir: '${PROJECT_SOURCE}', group: { kind: 'run', isDefault: true }, hotReloadCapable: true } },
                ],
            };

            const resolved = CommandResolver.resolveRunCommand(devfile, 'run');

            expect(resolved.hotReloadCapable).to.be.true;
        });

        test('falls back to /projects when the container has no explicit sourceMapping', () => {
            const devfile: Data = {
                schemaVersion: '2.2.0',
                metadata: { name: 'test-component', version: '1.0.0' },
                components: [
                    { name: 'runtime', container: { image: 'my-image:latest', memoryLimit: '512Mi', mountSources: true, volumeMounts: [], endpoints: [] } },
                ],
                commands: [
                    { id: 'run', exec: { commandLine: 'npm start', component: 'runtime', workingDir: '${PROJECT_SOURCE}', group: { kind: 'run', isDefault: true } } },
                ],
            };

            const resolved = CommandResolver.resolveRunCommand(devfile, 'run');

            expect(resolved.sourceMapping).to.equal('/projects');
        });

        test('throws when no command matches the requested group', () => {
            const devfile: Data = { ...baseDevfile(), commands: [] };

            expect(() => CommandResolver.resolveRunCommand(devfile, 'run')).to.throw('No devfile command found for group \'run\'');
        });
    });
});
