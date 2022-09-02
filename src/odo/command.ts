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
        const v = workspace.getConfiguration('openshiftConnector').get<number>('outputVerbosityLevel');
        const command = fn.apply(this, args) as CommandText;
        return v > 0 ? command.addOption(new CommandOption('-v', `${v}`)): command;
    };
}

export class Command {
    static createServiceCommand(fileName: string): CommandText {
        return new CommandText(
            'oc create',
            undefined, [
                new CommandOption('-f', fileName)
            ]
        )
    }

    static viewEnv(): CommandText {
        return new CommandText(
            'odo env view',
            undefined, [
                new CommandOption('-o', 'json', false)
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
        return new CommandText('odo project list -o json');
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
        return new CommandText('odo project set', name);
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
        return new CommandText('odo project create',
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
        return new CommandText('odo registry list -o json');
    }

    static addRegistry(name: string, url: string, token: string): CommandText {
        const cTxt =  new CommandText('odo registry add', `${name} ${url}`);
        if (token) {
            cTxt.addOption(new CommandOption('--token', token));
        }
        return cTxt;
    }

    static removeRegistry(name: string): CommandText {
        return new CommandText('odo registry delete', name, [new CommandOption('-f')]);
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

    static describeApplication(project: string, app: string): CommandText {
        return new CommandText('odo app describe',
            app, [
                new CommandOption('--project', project)
            ]
        );
    }

    static deleteApplication(project: string, app: string): CommandText {
        return new CommandText ('odo app delete',
            app, [
                new CommandOption('--project', project),
                new CommandOption('-f')
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
                new CommandOption('--token',ocToken),
                new CommandOption('--insecure-skip-tls-verify')
            ]
        );
    }

    static undeployComponent(project: string, app: string, component: string): CommandText {
        return new CommandText('odo delete',
            component, [
                new CommandOption('-f'),
                new CommandOption('--app', app),
                new CommandOption('--project', project)
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
                .addOption(new CommandOption('--project',project))
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
        return new CommandText('odo describe');
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
        return new CommandText('odo log');
    }

    static showLogAndFollow(): CommandText {
        return Command.showLog().addOption(new CommandOption('-f'));
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

    static linkComponentTo(
        project: string,
        app: string,
        component: string,
        componentToLink: string,
        port?: string,
    ): CommandText {
        const cTxt = new CommandText('odo link', componentToLink);
        cTxt.addOption(new CommandOption('--project',project))
            .addOption(new CommandOption('--app',app))
            .addOption(new CommandOption('--component', component))
            .addOption(new CommandOption('--wait'));
        if (port) {
            cTxt.addOption(new CommandOption('--port', port));
        }
        return cTxt;
    }

    static linkServiceTo(
        project: string,
        app: string,
        component: string,
        serviceToLink: string,
    ): CommandText {
        return new CommandText('odo link',
            serviceToLink, [
                new CommandOption('--wait'),
                new CommandOption('--wait-for-target')
            ]
        );
    }

    @verbose
    static pushComponent(configOnly = false, debug = false): CommandText {
        const cTxt = new CommandText('odo push');
        if (debug) {
            cTxt.addOption(new CommandOption('--debug'));
        }
        if (configOnly) {
            cTxt.addOption(new CommandOption('--config'));
        } else {
            cTxt.addOption(new CommandOption('--show-log'));
        }
        return cTxt;
    }

    @verbose
    static createLocalComponent(
        project: string,
        app: string,
        type = '', // will use empty string in case of undefined type passed in
        version: string,
        registryName: string,
        name: string,
        folder: string,
        starter: string = undefined,
        useExistingDevfile = false
    ): CommandText {
        const cTxt = new CommandText('odo create', `${type}${version?':':''}${version?version:''} ${name}`);
        if (version) {
            cTxt.addOption(new CommandOption('--s2i'));
        }
        if (registryName) {
            cTxt.addOption(new CommandOption('--registry', registryName));
        }
        cTxt.addOption(new CommandOption('--context', `"${folder}"`))
            .addOption(new CommandOption('--app', app))
            .addOption(new CommandOption('--project', project));
        if (starter) {
            cTxt.addOption(new CommandOption('--starter', starter, false));
        }
        if (useExistingDevfile) {
            cTxt.addOption(new CommandOption('--devfile', 'devfile.yaml', false));
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

    static unlinkComponents(
        project: string,
        app: string,
        comp1: string,
        comp2: string,
        port: string,
    ): CommandText {
        return new CommandText('odo unlink',
            comp2, [
                new CommandOption('--project', project),
                new CommandOption('--app', app),
                new CommandOption('--port', port),
                new CommandOption('--component', comp1)
            ]
        );
    }

    static unlinkService(project: string, service: string): CommandText {
        return new CommandText('odo unlink', service);
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
}
