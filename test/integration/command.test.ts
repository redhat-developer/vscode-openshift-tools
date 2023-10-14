/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { V221Devfile, V221DevfileCommandsItemsExecGroup } from '@devfile/api';
import { fail } from 'assert';
import { assert, expect } from 'chai';
import { ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as JSYAML from 'js-yaml';
import * as path from 'path';
import * as tmp from 'tmp';
import { promisify } from 'util';
import { EventEmitter, Terminal, window, workspace } from 'vscode';
import { CommandText } from '../../src/base/command';
import { CliChannel } from '../../src/cli';
import { Oc } from '../../src/oc/ocWrapper';
import { Command } from '../../src/odo/command';
import { ComponentDescription } from '../../src/odo/componentTypeDescription';
import { Odo } from '../../src/odo/odoWrapper';

const ODO = Odo.Instance;

const newProjectName = `project${Math.round(Math.random() * 1000)}`;

// tests are assuming your current context is already pointing to test cluster on which you can create and delete namespaces
suite('odo commands integration', function () {

    const isOpenShift: boolean = Boolean(process.env.IS_OPENSHIFT) || false;
    const clusterUrl = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
    const username = process.env.CLUSTER_USER || 'developer';
    const password = process.env.CLUSTER_PASSWORD || 'developer';

    suiteSetup(async function() {
        if (isOpenShift) {
            try {
                await Oc.Instance.logout();
            } catch (e) {
                // do nothing
            }
            await Oc.Instance.loginWithUsernamePassword(
                clusterUrl,
                username,
                password,
            );
        }
    });

    test('printOdoVersion()', async function () {
        await ODO.execute(Command.printOdoVersion());
    });

    suite('component', function() {
        const componentName = 'my-test-component';
        const componentType = 'go';
        const componentStarterProject = 'go-starter';
        let componentLocation: string;

        suiteSetup(async function () {
            await Odo.Instance.createProject(newProjectName);
            await Odo.Instance.setProject(newProjectName);
            componentLocation = await promisify(tmp.dir)();
            if (isOpenShift) {
                await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
            }
        });

        suiteTeardown(async function () {
            let toRemove = -1;
            for (let i = 0; i < workspace.workspaceFolders.length; i++) {
                if (workspace.workspaceFolders[i].uri.fsPath === componentLocation) {
                    toRemove = i;
                    break;
                }
            }
            if (toRemove !== -1) {
                workspace.updateWorkspaceFolders(toRemove, 1);
            }
            await fs.rm(componentLocation, { recursive: true, force: true });
            await Odo.Instance.deleteProject(newProjectName);
        });

        test('createLocalComponent()', async function () {
            await ODO.execute(
                Command.createLocalComponent(
                    componentType,
                    'DefaultDevfileRegistry',
                    componentName,
                    8080,
                    componentStarterProject,
                    undefined,
                    undefined,
                    '2.0.0'
                ),
                componentLocation
            );
            await fs.access(path.join(componentLocation, 'devfile.yaml'));
        });

        test('describeComponent()', async function() {
            const res = await ODO.execute(Command.describeComponent(), componentLocation);
            expect(res.stdout).contains(componentName);
            expect(res.stdout).contains('Go');
        });

        test('describeComponentJson()', async function () {
            const res = await ODO.execute(Command.describeComponentJson(), componentLocation);
            expect(res.stdout).contains(componentName);
            expect(res.stdout).contains(componentType);
        });

        suite('deploying', function() {
            // FIXME: Deploy depends on pushing container images to a registry.
            // The default registry it tries to push to is docker.
            // We shouldn't try to push to Docker Hub from these tests.
            // OpenShift comes with a registry built in to the cluster,
            // and there is a way to set this registry as the one that
            // odo pushes to during deploy.
            // However, you need cluster-admin access in order to expose
            // the registry outside of the cluster and figure out its address.
            test('deploy(): PENDING');
            test('undeploy(): PENDING');
        });

        test('dev()', async function() {
            const outputEmitter = new EventEmitter<string>();
            let devProcess: ChildProcess;
            function failListener(_error) {
                assert.fail('odo dev errored before it was closed');
            }
            const term = window.createTerminal({
                name: 'test terminal',
                pty: {
                    open: () => {
                        void CliChannel.getInstance().spawnTool(Command.dev(false)) //
                            .then(childProcess => {
                                devProcess = childProcess
                                devProcess.on('error', failListener);
                            });
                    },
                    close: () => {
                        if (devProcess) {
                            devProcess.removeListener('error', failListener);
                            devProcess.kill('SIGINT');
                        }
                    },
                    handleInput: (data: string) => {
                        if (data.length) {
                            if (devProcess) {
                                devProcess.removeListener('error', failListener);
                                devProcess.kill('SIGINT');
                            }
                        }
                    },
                    onDidWrite: outputEmitter.event
                }
            });
            await new Promise<void>(resolve => setTimeout(resolve, 3000));
            // we instruct the pseudo terminal to close the dev session when any text is sent
            term.sendText('a');
            term.dispose();
        });

        test('showLog()', async function () {
            await ODO.execute(Command.showLog(), componentLocation);
        });

        test('showLogAndFollow()', async function() {
            const outputEmitter = new EventEmitter<string>();
            let devProcess: ChildProcess;
            function failListener(_error) {
                assert.fail('showLogAndFollow() errored before it was closed');
            }
            const term = window.createTerminal({
                name: 'test terminal',
                pty: {
                    open: () => {
                        void CliChannel.getInstance().spawnTool(Command.showLogAndFollow()) //
                            .then(childProcess => {
                                devProcess = childProcess
                                devProcess.on('error', failListener);
                            });
                    },
                    close: () => {
                        if (devProcess) {
                            devProcess.removeListener('error', failListener);
                            devProcess.kill('SIGINT');
                        }
                    },
                    handleInput: (data: string) => {
                        if (data.length) {
                            if (devProcess) {
                                devProcess.removeListener('error', failListener);
                                devProcess.kill('SIGINT');
                            }
                        }
                    },
                    onDidWrite: outputEmitter.event
                }
            });
            await new Promise<void>(resolve => setTimeout(resolve, 1000));
            // we instruct the pseudo terminal to close the dev session when any text is sent
            term.sendText('a');
            term.dispose();
        });
    });

    suite('component dev', function() {
        const componentName = 'my-test-component';
        const componentType = 'nodejs';
        const componentStarterProject = 'nodejs-starter';
        let componentLocation: string;

        suiteSetup(async function () {
            if (isOpenShift) {
                await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
            }
            try {
                await Odo.Instance.createProject(newProjectName);
            } catch (e) {
                // do nothing; already exists
            }
            await Odo.Instance.setProject(newProjectName);
            componentLocation = await promisify(tmp.dir)();
        });

        suiteTeardown(async function () {
            let toRemove = -1;
            for (let i = 0; i < workspace.workspaceFolders.length; i++) {
                if (workspace.workspaceFolders[i].uri.fsPath === componentLocation) {
                    toRemove = i;
                    break;
                }
            }
            if (toRemove !== -1) {
                workspace.updateWorkspaceFolders(toRemove, 1);
            }
            await fs.rm(componentLocation, { recursive: true, force: true });
            await Odo.Instance.deleteProject(newProjectName);
        });

        interface TerminalListener {
            onOutput(data: string): void;
            onError(data:string): void;
        }

        function executeCommandInTerminal(commandText: CommandText, cwd: string, listener?: TerminalListener) : Terminal {
            const outputEmitter = new EventEmitter<string>();
            outputEmitter.event(data => {
                if (listener) listener.onOutput(data);
            });
            let devProcess: ChildProcess;
            function failListener(_error) {
                assert.fail('odo dev errored before it was closed');
            }
            return window.createTerminal({
                name: 'test terminal',
                pty: {
                    open: () => {
                        void CliChannel.getInstance().spawnTool(Command.dev(true),
                            {
                                cwd
                            })
                            .then(childProcess => {
                                devProcess = childProcess
                                devProcess.on('error', failListener);
                                devProcess.stdout.on('data', data => {
                                    if (listener) listener.onOutput(data);
                                });
                                devProcess.stderr.on('data', data => {
                                    if (listener) listener.onError(data);
                                });
                            });
                    },
                    close: () => {
                        if (devProcess) {
                            devProcess.removeListener('error', failListener);
                            devProcess.kill('SIGINT');
                        }
                    },
                    handleInput: (data: string) => {
                        // Close terminal on any input
                        if (data.length) {
                            if (devProcess) {
                                devProcess.removeListener('error', failListener);
                                devProcess.kill('SIGINT');
                            }
                        }
                    },
                    onDidWrite: outputEmitter.event
                }
            });
        }

        async function startDevInTerminal(cwd?) : Promise<Terminal> {
            let termOutput = '';
            let termError = '';
            const term = executeCommandInTerminal(Command.dev(true), cwd, {
                onOutput(data) {
                    termOutput = termOutput.concat(data);
                },
                onError(data) {
                    termError = termError.concat(data);
                }
            });

            let hopesLeft = 30;
            let devIsRunning = false;
            do {
                hopesLeft--;
                await new Promise<void>(resolve => setTimeout(resolve, 2000));
                let index = termOutput.indexOf(`Developing using the "${componentName}" Devfile`);
                if (index >= 0) index = termOutput.indexOf('✓  Pod is Running', index);
                if (index >= 0) index = termOutput.indexOf('↪ Dev mode', index);
                devIsRunning = (index >= 0);
            } while (hopesLeft > 0 && !devIsRunning);
            if (!devIsRunning) {
                if (termError.trim().length > 0) {
                    fail(`Start Dev failed: ${termError}`);
                }
                fail('Waiting for pod to start is timed out');
            }
            return term;
        }

        const helloWorldCommandId = 'hello-world';
        const helloWorldCommandOutput = 'Hello, World!';
        const helloWorldCommandExecCommandLine = `echo "${helloWorldCommandOutput}"`;

        async function runComponentCommandInTerminal(commandId: string, cwd?) : Promise<Terminal> {
            let termOutput = '';
            let termError = '';
            const term = executeCommandInTerminal(Command.runComponentCommand(commandId), cwd, {
                onOutput(data) {
                    termOutput = termOutput.concat(data);
                },
                onError(data) {
                    termError = termError.concat(data);
                }
            });

            let hopesLeft = 30;
            let commandIdRunning = false;
            do {
                hopesLeft--;
                await new Promise<void>(resolve => setTimeout(resolve, 2000));
                commandIdRunning = termOutput.indexOf(helloWorldCommandOutput) >= -1;
            } while (hopesLeft > 0 && !commandIdRunning);
            if (!commandIdRunning) {
                if (termError.trim().length > 0) {
                    fail(`Run Component Command failed: ${termError}`);
                }
                fail('Waiting for command to start executing is timed out');
            }
            return term;
        }

        async function fixupDevFile(devfilePath: string): Promise<void> {
            // Parse YAML into an Object, add:
            //
            // - exec:
            //     group:
            //       kind: run
            //     commandLine: echo "Hello, World!"
            //     component: runtime
            //   id: hello-world
            //
            // and then save into the same debfile.yaml
            const file = await fs.readFile(devfilePath, 'utf8');
            const devfile = JSYAML.load(file.toString()) as V221Devfile;
            if (!devfile || !devfile.commands) {
                fail(`DevFile '${devfilePath}' cannot be read`);
            }
            const devfileCommands = devfile.commands;
            let helloWorldCommand;
            for (let i = 0; i < devfileCommands.length; i++) {
                if(devfileCommands[i].id === helloWorldCommandId) {
                    helloWorldCommand = devfileCommands[i];
                    break;
                }
            }
            if (helloWorldCommand) {
                helloWorldCommand.exec = {
                    group:{
                        kind: V221DevfileCommandsItemsExecGroup.KindEnum.Run
                    },
                    commandLine: helloWorldCommandExecCommandLine,
                    component: 'runtime'
                }
            } else {
                devfileCommands.push({
                    exec: {
                        group:{
                            kind: V221DevfileCommandsItemsExecGroup.KindEnum.Run
                        },
                        commandLine: helloWorldCommandExecCommandLine,
                        component: 'runtime'
                    },
                    id: helloWorldCommandId
                })
            }
            await fs.writeFile(devfilePath, JSYAML.dump(devfile));
        }

        test('runComponentCommand()', async function () {
             await ODO.execute(
                Command.createLocalComponent(
                    componentType,
                    'DefaultDevfileRegistry',
                    componentName,
                    undefined,
                    componentStarterProject,
                    undefined,
                    undefined,
                    '2.1.1'
                ),
                componentLocation
            );
            const devfilePath = path.join(componentLocation, 'devfile.yaml')
            await fs.access(devfilePath);

            await fixupDevFile(devfilePath);

            const describeCmdResult = await ODO.execute(Command.describeComponentJson(), componentLocation);
            const componentDescription = JSON.parse(describeCmdResult.stdout) as ComponentDescription;
            expect(componentDescription.devfileData.devfile.commands[0]?.id).exist;

            const commands = componentDescription.devfileData.devfile.commands
            let helloCommand: Command;
            for (let i = 0; i < commands.length; i++) {
                if (commands[i].id && helloWorldCommandId === commands[i].id) {
                    helloCommand = commands[i];
                    break;
                }
            }
            if (!helloCommand) {
                fail(`Command '${helloWorldCommandId}' doesn't exist in Component '${componentName}'`);
            }

            let devTerm : Terminal;
            let runCommandTerm : Terminal;
            try {
                devTerm = await startDevInTerminal(componentLocation);
                runCommandTerm = await runComponentCommandInTerminal(helloWorldCommandId, componentLocation);
            } finally {
                // we instruct the pseudo terminals to close the dev session when any text is sent
                if (runCommandTerm) {
                    runCommandTerm.sendText('exit');
                    runCommandTerm.dispose();
                }
                if (devTerm) {
                    devTerm.sendText('exit');
                    devTerm.dispose();
                }
            }
        });
    });
});
