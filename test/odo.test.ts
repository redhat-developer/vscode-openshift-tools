/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as odo from '../src/odo';
import { CliExitData, Cli } from '../src/cli';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { ToolsConfig } from '../src/tools';
import * as shelljs from "shelljs";

suite("odo integration tests", () => {
    const odoCli: odo.Odo = odo.OdoImpl.getInstance();
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(ToolsConfig, 'getVersion').resolves('0.0.15');
    });

    teardown(() => {
        sandbox.restore();
    });

    suite("odo catalog integration", () => {
        const http = 'httpd';
        const nodejs = 'nodejs';
        const python = 'python';

        const odoCatalog: string = [
            `NAME            PROJECT                 TAGS`,
            `${nodejs}       openshift               1.0`,
            `${python}       openshift               1.0,2.0`,
            `${http}         openshift               2.2,2.3,latest`
        ].join('\n');
        let result: string[];
        const catalogData: CliExitData = {
            error: null,
            stderr: '',
            stdout: odoCatalog
        };

        setup(async () => {
            sandbox.stub(odo.OdoImpl.prototype, 'execute').resolves(catalogData);
            result = await odoCli.getComponentTypes();
        });

        test("Odo->getComponentTypes() returns correct number of component types", () => {
            assert.equal(result.length, 3);
        });

        test("Odo->getComponentTypes() returns correct component type names", () => {
            const resultArray = result.filter((element: string) => {
                return element === http || element === nodejs || element === python;
            });
            assert.equal(resultArray.length, 3);
        });

        test("Odo->getComponentTypeVersions() returns correct number of tags for component type", () => {
            return Promise.all([
                odoCli.getComponentTypeVersions(nodejs).then((result)=> {
                    assert.equal(result.length, 1);
                }),
                odoCli.getComponentTypeVersions(python).then((result)=> {
                    assert.equal(result.length, 2);
                }),
                odoCli.getComponentTypeVersions(http).then((result)=> {
                    assert.equal(result.length, 3);
                })
            ]);
        });
    });

    suite("odo service integration", () => {
        const svc1 = 'svc1';
        const svc2 = 'svc2';
        const svc3 = 'svc3';

        const odoPlans: string = [
            `NAME      PLANS`,
            `${svc1}   default,free,paid`,
            `${svc2}   default,free`,
            `${svc3}   default`
        ].join('\n');
        const data: CliExitData = { error: undefined, stderr: null, stdout: odoPlans };

        setup(() => {
            sandbox.stub(odo.OdoImpl.prototype, 'execute').resolves(data);
        });

        test("Odo->getServiceTemplates() returns correct number of services", async () => {
            const result: string[] = await odoCli.getServiceTemplates();
            assert.equal(result.length, 3);
            assert.equal(result[0], svc1);
            assert.equal(result[1], svc2);
            assert.equal(result[2], svc3);
        });

        test("Odo->getServiceTemplatePlans(service) returns correct number of plans from service", async () => {
            const result: string[] = await odoCli.getServiceTemplatePlans(svc1);
            assert.equal(result.length, 3);
            assert.equal(result[0], 'default');
            assert.equal(result[1], 'free');
            assert.equal(result[2], 'paid');
        });
    });

    suite('odo and oc current cluster detection integration', () => {
        const clusterUrl = 'https://localhost:8443';

        const odoVersionOutLoggedIn = [
            'odo v0.0.15 (2f7ed497)',
            '',
            `Server: ${clusterUrl}`,
            'Kubernetes: v1.11.0+d4cacc0'
        ];
        const odoVersionOutLoggedOut = [
            'odo v0.0.15 (2f7ed497)',
            '',
            'Kubernetes: v1.11.0+d4cacc0'
        ];
        const oc = [
            'oc v3.9.0+191fece',
            'kubernetes v1.9.1+a0ce1bc657',
            'features: Basic-Auth',
            '',
            `Server ${clusterUrl}`,
            'kubernetes v1.11.0+d4cacc0'
        ];

        test('extension first use odo version to get cluster url', async () => {
            sandbox.stub(odo.OdoImpl.prototype, 'execute').resolves({
                error: undefined,
                stdout: odoVersionOutLoggedIn.join('\n'),
                stderr: undefined
            });
            const cluster: odo.OpenShiftObject[] = await odo.getInstance().getClusters();
            assert.equal(cluster[0].getName(), clusterUrl);
        });

        test('extension use oc verdion to get cluster url as a backup plan', async () => {
            sandbox.stub(odo.OdoImpl.prototype, 'execute').onFirstCall().resolves({
                error: undefined,
                stdout: odoVersionOutLoggedOut.join('\n'),
                stderr: undefined
            }).onSecondCall().resolves({
                error: undefined,
                stdout: oc.join('\n'),
                stderr: undefined
            });
            const cluster: odo.OpenShiftObject[] = await odo.getInstance().getClusters();
            assert.equal(cluster[0].getName(), clusterUrl);
        });
    });
});