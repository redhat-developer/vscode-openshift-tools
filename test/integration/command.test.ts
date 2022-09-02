/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandText } from '../../src/base/command';
import { Command } from '../../src/odo/command';
import { getInstance } from '../../src/odo';
import { KubeConfig } from '@kubernetes/client-node';
import * as tmp from 'tmp';
import { extensions } from 'vscode';
import cp = require('child_process');

const ODO = getInstance();
const kc = new KubeConfig();

kc.loadFromDefault();

const newProjectName = `project${Math.round(Math.random() * 1000)}`;
const newAppName = 'integration';
// devfileTypeName = 'nodejs';

async function clone(repositoryURL: string, location: string): Promise<void> {
    const gitExtension = extensions.getExtension('vscode.git').exports;
    const git = gitExtension.getAPI(1).git.path;
    // run 'git clone url location' as external process and return location
    return new Promise((resolve, reject) => cp.exec(`${git} clone ${repositoryURL} ${location}`, (error: cp.ExecException) => error ? reject(error) : resolve()));
}

// tests are assuming your current context is already pointing to test cluster
suite('odo commands integration', () => {

    test('odoLoginWithUsernamePassword()', () => {
        return ODO.execute(
            Command.odoLoginWithUsernamePassword(
                kc.getCurrentCluster().server,
                'developer',
                'developer'
            )
        )
    });

    test('listProjects()', () => {
        // test is assuming your current context is aready pointing to test cluster
        return ODO.execute(
            Command.listProjects()
        )
    });

    test('listApplications()', () => {
        // test is assuming your current context is aready pointing to test cluster
        return ODO.execute(
            new CommandText('odo project get -o json')
        ).then(result => {
            return JSON.parse(result.stdout).metadata.name;
        }).then(project => {
            return ODO.execute(
                Command.listApplications(project)
            );
        });
    });

    test('createProject()', ()=> {
        return ODO.execute(
            Command.createProject(newProjectName)
        );
    });

    test('deleteProject()', ()=> {
        return ODO.execute(
            Command.deleteProject(newProjectName)
        );
    });

    test('listRegistries()', ()=> {
        return ODO.execute(
            Command.listRegistries()
        );
    });

    test('listCatalogComponents()', ()=> {
        return ODO.execute(
            Command.listCatalogComponents()
        );
    });

    test('listCatalogComponentsJson()', ()=> {
        return ODO.execute(
            Command.listCatalogComponentsJson()
        );
    });

    test('listCatalogServices()', ()=> {
        return ODO.execute(
            Command.listCatalogServices()
        );
    });

    test('listCatalogServicesJson()', ()=> {
        return ODO.execute(
            Command.listCatalogServicesJson()
        );
    });

    test('printOcVersion()', ()=> {
        return ODO.execute(
            Command.printOcVersion()
        );
    });

    test('printOdoVersion()', ()=> {
        return ODO.execute(
            Command.printOdoVersion()
        );
    });

    test('showServerUrl()', () => {
        return ODO.execute(
            Command.showServerUrl()
        );
    });

    test('showConsoleUrl()', async function() {
        const canI = await ODO.execute(
            new CommandText('oc auth can-i get configmap --namespace openshift-config-managed'),
            undefined,
            false
        ).then(result => {
            return !result.stdout.startsWith('no')
        });
        if (!canI) {
            this.skip();
        } else {
            await ODO.execute(
                Command.showConsoleUrl()
            );
            }
    });

    test('getClusterVersion()', async function() {
        const clusterVersionExists = await ODO.execute(
            new CommandText('oc api-resources --verbs=list -o name')
        ).then((resNames) => {
            return resNames.stdout.includes('clusterversion');
        });
        if (!clusterVersionExists) {
            this.skip();
        } else {
            await ODO.execute(
                Command.getclusterVersion()
            );
        }
    });

    test('describeCatalogComponent()', async function () {
        const types = await ODO.getComponentTypes();
        const devfileCompType = types[0];
        if (!devfileCompType) {
            this.skip();
        } else {
            await ODO.execute(Command.describeCatalogComponent(devfileCompType.name, devfileCompType.registryName));
        }
    });

    test('setOpenShiftContext', async () => {
        await ODO.execute(Command.setOpenshiftContext(kc.currentContext));
    });

    suite('s2i', () => {
        const project = kc.getContextObject(kc.getCurrentContext()).namespace;
        const newNodeJsComponent = 'nodejs-local-app';
        const componentLocation = tmp.dirSync().name;
        const newUrlName = 'new-url-name';
        const newUrlNameSecure = 'new-url-name-secure';
        const nodeJsExGitUrl = 'https://github.com/sclorg/nodejs-ex.git';

        test('createLocalComponent()', async () => {
            await clone(nodeJsExGitUrl, componentLocation);
            await ODO.execute(
                Command.createLocalComponent(
                    project,
                    newAppName,
                    'nodejs',
                    'latest',
                    undefined,
                    newNodeJsComponent,
                    componentLocation
                )
            );
        });
        test('describeApplication', async () => {
            await ODO.execute(Command.describeApplication(project, newAppName));
        });
        test('listComponents()', async () => {
            await ODO.execute(Command.listComponents(project, newAppName));
        });
        test('createComponentCustomUrl(unsecure)', async () => {
            await ODO.execute(Command.createComponentCustomUrl(newUrlName, '8080', false), componentLocation);
        });
        test('createComponentCustomUrl(secure)', async () => {
            await ODO.execute(Command.createComponentCustomUrl(newUrlNameSecure, '8080', true), componentLocation);
        });
        test('describeComponentJson()', async () => {
            await ODO.execute(Command.describeComponentJson(),componentLocation);
        });
        test('describeComponentNoContextJson()', async () => {
            await ODO.execute(Command.describeComponentNoContextJson(project, newAppName, newNodeJsComponent),tmp.dirSync().name);
        });
        test('pushComponent()', async () => {
            await ODO.execute(Command.pushComponent(), componentLocation);
        });
        test('showLog()', async () => {
            await ODO.execute(Command.showLog(), componentLocation);
        });
        test('createComponentCustomUrl(secure)', async () => {
            await ODO.execute(Command.createComponentCustomUrl(`${newUrlNameSecure}2`, '8080', true), componentLocation);
        });
        test('pushComponent(config, debug)', async () => {
            await ODO.execute(Command.pushComponent(true, true), componentLocation);
        });
        test('deleteComponentUrl', async () => {
            await ODO.execute(Command.deleteComponentUrl(newUrlName),componentLocation);
        });
        test('undeployComponent', async () => {
            await ODO.execute(Command.undeployComponent(project, newAppName, newNodeJsComponent), componentLocation);
        });
        test('deleteComponent', async () => {
            await ODO.execute(Command.deleteComponent(project, newAppName, newNodeJsComponent, true), componentLocation);
        });
    });
});