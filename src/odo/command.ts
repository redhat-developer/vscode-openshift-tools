/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/ban-types */

import { workspace } from 'vscode';
import { CommandOption, CommandText } from '../base/command';

function verbose(_: unknown, key: string, descriptor: TypedPropertyDescriptor<Function>): void {
    let fnKey: string | undefined;
    let fn: Function | undefined;

    if (typeof descriptor.value === 'function') {
        fnKey = 'value';
        fn = descriptor.value;
    } else {
        throw new Error('not supported');
    }

    descriptor[fnKey] = function(...args: unknown[]): unknown {
        const v = workspace.getConfiguration('openshiftToolkit').get<number>('outputVerbosityLevel');
        const command = fn.apply(this, args) as CommandText;
        return v > 0 ? command.addOption(new CommandOption('-v', `${v}`)) : command;
    };
}

export class Command {

    static searchPreviousReleaseResources(name: string): CommandText {
        return new CommandText('oc get', 'deployment', [
            new CommandOption('-o', `jsonpath="{range .items[?(.metadata.labels.component=='${name}')]}{.metadata.labels.app\\.kubernetes\\.io\\/managed-by}{':'}{.metadata.labels.app\\.kubernetes\\.io\\/managed-by-version}{end}"`)
        ]);
    }

    static deletePreviouslyPushedResouces(name: string): CommandText {
        return new CommandText('oc delete', 'deployment', [
            new CommandOption('-l', `component='${name}'`),
            new CommandOption('--cascade')
        ])
    }

    static deploy(): CommandText {
        return new CommandText('odo', 'deploy');
    }

    static undeploy(name?: string): CommandText {
        const command = new CommandText('odo delete', 'component');
        if (name) {
            command.addOption(new CommandOption('--name', name));
        }
        return command;
    }

    static dev(): CommandText {
        return new CommandText('odo', 'dev', []);
    }

    static createServiceCommand(fileName: string): CommandText {
        return new CommandText(
            'oc create',
            undefined, [
            new CommandOption('-f', fileName)
        ]
        );
    }

    static printCatalogComponentImageStreamRefJson(name: string, namespace: string): CommandText {
        return new CommandText(
            'oc get imagestream',
            name, [
            new CommandOption('-n', namespace),
            new CommandOption('-o', 'json', false)
        ]
        );
    }

    static listProjects(): CommandText {
        return new CommandText('oc',
            'get project', [
            new CommandOption('-o', 'json', false)
        ]
        );
    }

    @verbose
    static listApplications(project: string): CommandText {
        return new CommandText(
            'odo application list',
            undefined, [
            new CommandOption('--project', project),
            new CommandOption('-o', 'json', false)
        ]
        );
    }

    static setActiveProject(name: string): CommandText {
        return new CommandText('odo set project', name);
    }

    static deleteProject(name: string): CommandText {
        return new CommandText(
            'odo project delete',
            name, [
            new CommandOption('-w'),
            new CommandOption('-o', 'json', false)
        ]
        );
    }

    @verbose
    static createProject(name: string): CommandText {
        return new CommandText('odo create namespace',
            name, [
            new CommandOption('-w')
        ]
        );
    }

    static listComponents(project: string, app: string): CommandText {
        return new CommandText('odo list',
            undefined, [
            new CommandOption('--app', app),
            new CommandOption('--project', project),
            new CommandOption('-o', 'json', false)
        ]
        );
    }

    static listRegistries(): CommandText {
        return new CommandText('odo preference view -o json');
    }

    static addRegistry(name: string, url: string, token: string): CommandText {
        const cTxt =  new CommandText('odo preference add registry', `${name} ${url}`);
        if (token) {
            cTxt.addOption(new CommandOption('--token', token));
        }
        return cTxt;
    }

    static removeRegistry(name: string): CommandText {
        return new CommandText('odo preference remove registry', name, [new CommandOption('--force')]);
    }

    static listCatalogComponents(): CommandText {
        return new CommandText('odo registry');
    }

    static listCatalogComponentsJson(): CommandText {
        return new CommandText(`${Command.listCatalogComponents().toString()} -o json`);
    }

    static listCatalogServices(): CommandText {
        return new CommandText('odo catalog list services');
    }

    static listCatalogOperatorBackedServices(): CommandText {
        return new CommandText('oc get csv -o jsonpath="{range .items[*]}{.metadata.name}{\'\\t\'}{.spec.version}{\'\\t\'}{.spec.displayName}{\'\\t\'}{.metadata.annotations.description}{\'\\t\'}{.spec.customresourcedefinitions.owned}{\'\\n\'}{end}"');
    }

    static listCatalogServicesJson(): CommandText {
        return new CommandText(`${Command.listCatalogServices().toString()} -o json`);
    }

    static printOcVersion(): CommandText {
        return new CommandText('oc version');
    }

    static printOcVersionJson(): CommandText {
        return new CommandText('oc version -ojson');
    }

    static listServiceInstances(project: string, app: string): CommandText {
        return new CommandText('odo service list',
            undefined, [
            new CommandOption('-o', 'json', false),
            new CommandOption('--project', project),
            new CommandOption('--app', app)
        ]
        );
    }

    static printOdoVersion(): CommandText {
        return new CommandText('odo version');
    }

    static odoLogout(): CommandText {
        return new CommandText('odo logout');
    }

    static setOpenshiftContext(context: string): CommandText {
        return new CommandText('oc config use-context',
            context
        );
    }

    static odoLoginWithUsernamePassword(
        clusterURL: string,
        username: string,
        passwd: string,
    ): CommandText {
        return new CommandText('odo login',
            clusterURL, [
            new CommandOption('-u', username, true, true),
            new CommandOption('-p', passwd, true, true),
            new CommandOption('--insecure-skip-tls-verify')
        ]
        );
    }

    static odoLoginWithToken(clusterURL: string, ocToken: string): CommandText {
        return new CommandText('odo login',
            clusterURL, [
            new CommandOption('--token', ocToken),
            new CommandOption('--insecure-skip-tls-verify')
        ]
        );
    }

    static deleteComponent(project: string, app: string, component: string, context: boolean): CommandText {
        const ct = new CommandText('odo delete',
            context ? undefined : component, [ // if there is not context name is required
            new CommandOption('-f'),
        ]
        );
        if (!context) { // if there is no context state app and project name
            ct.addOption(new CommandOption('--app', app))
                .addOption(new CommandOption('--project', project))
        } else {
            ct.addOption(new CommandOption('--all'));
        }
        return ct;
    }

    static deleteComponentNoContext(project: string, app: string, component: string): CommandText {
        return new CommandText('oc delete',
            'deployment', [
            new CommandOption('-n', project),
            new CommandOption('-l', `component=${component},app=${app}`),
            new CommandOption('--wait=true'),
        ]
        );
    }

    static deleteDeploymentByName(project: string, name: string): CommandText {
        return new CommandText('oc delete deployment',
            name, [
            new CommandOption('-n', project),
            new CommandOption('--wait=true'),
        ]
        );
    }

    static describeComponentNoContext(project: string, app: string, component: string): CommandText {
        return new CommandText('odo describe',
            component, [
            new CommandOption('--app', app),
            new CommandOption('--project', project)
        ]
        );
    }

    static describeComponentNoContextJson(project: string, app: string, component: string): CommandText {
        return this.describeComponentNoContext(project, app, component)
            .addOption(new CommandOption('-o', 'json', false));
    }

    static describeComponent(): CommandText {
        return new CommandText('odo describe component');
    }

    static describeComponentJson(): CommandText {
        return Command.describeComponent().addOption(new CommandOption('-o', 'json', false));
    }

    static describeService(service: string): CommandText {
        return new CommandText('odo catalog describe service', service);

    }

    static describeCatalogComponent(component: string, registry: string): CommandText {
        return new CommandText('odo',
            'registry', [
            new CommandOption('--details'),
            new CommandOption('--devfile', component),
            new CommandOption('--devfile-registry', registry),
            new CommandOption('-o', 'json', false)
        ]
        );
    }

    static showLog(): CommandText {
        return new CommandText('odo', 'logs', [new CommandOption('--dev')]);
    }

    static showLogAndFollow(): CommandText {
        return Command.showLog().addOption(new CommandOption('--follow'));
    }

    static listComponentPorts(project: string, app: string, component: string): CommandText {
        return new CommandText('oc get service',
            `${component}-${app}`, [
            new CommandOption('--namespace', project),
            // see https://kubernetes.io/docs/reference/kubectl/jsonpath/ for examples
            new CommandOption('-o', 'jsonpath="{range .spec.ports[*]}{.port}{\',\'}{end}"', false)
        ]
        );
    }

    @verbose
    static createLocalComponent(
        type = '', // will use empty string in case of undefined type passed in
        registryName: string,
        name: string,
        starter: string = undefined,
        useExistingDevfile = false,
        customDevfilePath = ''
    ): CommandText {
        const cTxt = new CommandText('odo', 'init', [
            new CommandOption('--name', name)
        ]
        );
        if(type !== '') {
            cTxt.addOption(new CommandOption('--devfile', type));
        }
        if (registryName) {
            cTxt.addOption(new CommandOption('--devfile-registry', registryName));
        }
        if (starter) {
            cTxt.addOption(new CommandOption('--starter', starter, false));
        }
        if (useExistingDevfile && customDevfilePath.length === 0) {
            cTxt.addOption(new CommandOption('--devfile-path', 'devfile.yaml', false));
        }
        if(customDevfilePath.length > 0) {
            cTxt.addOption(new CommandOption('--devfile-path', customDevfilePath, false));
        }
        return cTxt;
    }

    static testComponent(): CommandText {
        return new CommandText('odo test --show-log');
    }

    @verbose
    static createService(
        project: string,
        app: string,
        template: string,
        plan: string,
        name: string,
    ): CommandText {
        return new CommandText('odo service create',
            `${template} ${name}`, [
            new CommandOption('--plan', plan),
            new CommandOption('--app', app),
            new CommandOption('--project', project),
            new CommandOption('-w')
        ]
        );
    }

    static deleteService(name: string): CommandText {
        return new CommandText('oc delete', name);
    }

    static getServiceTemplate(project: string, service: string): CommandText {
        return new CommandText('oc get ServiceInstance',
            service, [
            new CommandOption('--namespace', project),
            new CommandOption('-o', 'jsonpath="{$.metadata.labels.app\\.kubernetes\\.io/name}"', false)
        ]
        );
    }

    static waitForServiceToBeGone(project: string, service: string): CommandText {
        return new CommandText('oc wait',
            `ServiceInstance/${service}`, [
            new CommandOption('--for', 'delete', false),
            new CommandOption('--namespace', project)
        ]
        );
    }

    @verbose
    static createComponentCustomUrl(name: string, port: string, secure = false): CommandText {
        const cTxt = new CommandText('odo url create',
            name, [
            new CommandOption('--port', port)
        ]
        );
        if (secure) {
            cTxt.addOption(new CommandOption('--secure'));
        }
        return cTxt;
    }

    static getComponentUrl(): CommandText {
        return new CommandText('odo url list -o json');
    }

    static deleteComponentUrl(name: string): CommandText {
        return new CommandText('odo url delete',
            name, [
            new CommandOption('-f'),
            new CommandOption('--now')
        ]
        );
    }

    static getComponentJson(): CommandText {
        return new CommandText('odo describe -o json');
    }

    static getclusterVersion(): CommandText {
        return new CommandText('oc get clusterversion -o json');
    }

    static showServerUrl(): CommandText {
        return new CommandText('oc whoami --show-server');
    }

    static showConsoleUrl(): CommandText {
        return new CommandText('oc get configmaps console-public -n openshift-config-managed -o json');
    }

    static getClusterServiceVersionJson(name: string) {
        return new CommandText('oc get csv',
            name, [
            new CommandOption('-o', 'json')
        ]
        );
    }

    static analyze(): CommandText {
        return new CommandText('odo analyze -o json');
    }
}
