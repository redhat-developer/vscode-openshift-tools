//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as odo from '../src/odo';
import  { Cli, CliExitData, create } from '../src/cli';
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as vscode from 'vscode';
// import * as myExtension from '../extension';

// Defines a Mocha test suite to group tests of similar kind together

suite("Extension Tests", function () {

    function create(stdout: string){
        return {
            execute : function(cmd: string, env: any): Promise<CliExitData> {
                return Promise.resolve({
                    code: 0,
                    stderr: '',
                    stdout
                });
            }
        };
    }

    const componentName = 'httpd';
    const c: Cli = create(
`NAME                                    TAGS
fis-java-openshift                      1.0,2.0
fis-karaf-openshift                     1.0,2.0
${componentName}                        2.2,2.3,2.4,latest`);

    suite("odo getComponentTypes()", function() {
        test("returns correct number of component types", function() {
            const o: odo.Odo = odo.create(c);
            return o.getComponentTypes().then((result)=> {
                assert(result.length === 3, 'getComponentTypes() returned wrong number of component types');
            });
        });
    });

    suite("odo getComponentTypeVersions()", function() {
        test("returns correct number of component types", function() {
            const o: odo.Odo = odo.create(c);
            return o.getComponentTypeVersions(componentName).then((result)=> {
                assert(result.length === 4, 'getComponentTypes() returned wrong number of component types');
            });
        });
    });
});