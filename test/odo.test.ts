/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as odo from '../src/odo';
import { OpenShiftObject } from '../src/odo';
import  { ICli, CliExitData, create } from '../src/cli';
import * as assert from 'assert';
import { RSA_PKCS1_OAEP_PADDING } from 'constants';
import { FunctionBreakpoint } from 'vscode';

suite("odo integration tests", () => {

    function create(stdout: string) {
        return {
            execute : (cmd: string, env: any): Promise<CliExitData> => {
                return Promise.resolve({
                    error: undefined,
                    stderr: '',
                    stdout
                });
            }
        };
    }

    suite("odo catalog integration", () => {
        const http = 'httpd';
        const nodejs = 'nodejs';
        const python = 'python';

        const odoCatalogCli: ICli = create([
            `NAME            PROJECT                 TAGS`,
            `${nodejs}       openshift               1.0`,
            `${python}       openshift               1.0,2.0`,
            `${http}         openshift               2.2,2.3,latest`
        ].join('\n'));
        let result: string[];

        suiteSetup(async () => {
            result = await odo.create(odoCatalogCli).getComponentTypes();
        });

        test("Odo->getComponentTypes() returns correct number of component types", () => {
            assert(result.length === 3);
        });

        test("Odo->getComponentTypes() returns correct component type names", () => {
            const resultArray = result.filter((element: string) => {
                return element === http || element === nodejs || element === python;
            });
            assert(resultArray.length === 3);
        });

        test("Odo->getComponentTypeVersions() returns correct number of tags for component type", () => {
            return Promise.all([
                odo.create(odoCatalogCli).getComponentTypeVersions(nodejs).then((result)=> {
                    assert(result.length === 1);
                }),
                odo.create(odoCatalogCli).getComponentTypeVersions(python).then((result)=> {
                    assert(result.length === 2);
                }),
                odo.create(odoCatalogCli).getComponentTypeVersions(http).then((result)=> {
                    assert(result.length === 3);
                })
            ]);
        });
    });

    suite("odo service integration", () => {
        const svc1 = 'svc1';
        const svc2 = 'svc2';
        const svc3 = 'svc3';

        const odoProjCli: ICli = create([
            `The following services can be deployed:`,
            `- ${svc1}`,
            `- ${svc2}`,
            `- ${svc3}`
        ].join('\n'));

        let result: string[];

        suiteSetup(async () => {
            result = await odo.create(odoProjCli).getServiceTemplates();
        });

        test("Odo->getServiceTemplates() returns correct number of services", () => {
            assert(result.length === 3);
        });
    });

});