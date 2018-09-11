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

suite("odo integration tests", function () {

    function create(stdout: string){
        return {
            execute : function(cmd: string, env: any): Promise<CliExitData> {
                return Promise.resolve({
                    error: undefined,
                    stderr: '',
                    stdout
                });
            }
        };
    }

    suite("odo catalog integration", function() {
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

        suiteSetup(async function() {
            result = await odo.create(odoCatalogCli).getComponentTypes();
        });

        test("Odo->getComponentTypes() returns correct number of component types", function() {
            assert(result.length === 3);
        });

        test("Odo->getComponentTypes() returns correct component type names", function() {
            const resultArray = result.filter(function(element:string) {
                return element === http || element === nodejs || element === python;
            });
            assert(resultArray.length === 3);
        });

        test("Odo->getComponentTypeVersions() returns correct number of tags for component type", function() {
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

    suite("odo app integration", function() {
        const app1 = 'app1';    
        const app2 = 'app2';  
        const app3 = 'app3';    
    
        const odoAppCli: ICli = create([
            `ACTIVE  NAME`,
            `  *     ${app1}`,
            `        ${app2}`,
            `        ${app3}`
        ].join('\n'));
        
        let result: OpenShiftObject[];
        const osProj = <OpenShiftObject> {
            getName: () => "project1"
        };

        suiteSetup(async function() {
            result = await odo.create(odoAppCli).getApplications(osProj);
        });

        test("Odo->getApplications(project) returns correct number of applications", function() {
            assert(result.length === 3);
        });
    });

    suite("odo project integration", function() {
        const proj1 = 'proj1';    
        const proj2 = 'proj2';  
        const proj3 = 'proj3';    
    
        const odoProjCli: ICli = create([
            `ACTIVE  NAME`,
            `  *     ${proj1}`,
            `        ${proj2}`,
            `        ${proj3}`
        ].join('\n'));
        
        let result: OpenShiftObject[];

        suiteSetup(async function() {
            result = await odo.create(odoProjCli).getProjects();
        });

        test("Odo->getProjects() returns correct number of projects", function() {
            assert(result.length === 3);
        });
    });
});