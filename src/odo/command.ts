/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandOption, CommandText, verbose } from '../base/command';

export class Command {

    static deletePreviouslyPushedResources(name: string): CommandText {
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

    static dev(debug: boolean, runOn?: undefined | 'podman'): CommandText {
        const command = new CommandText('odo', 'dev');
        if (debug) {
            command.addOption(new CommandOption('--debug'));
        }
        if (runOn) {
            command.addOption(new CommandOption('--platform', 'podman'));
            command.addOption(new CommandOption('--forward-localhost'));
        }
        return command;
    }

    static ocCreate(fileName: string, namespace?: string): CommandText {
        const cmd =  new CommandText(
            'oc create',
            undefined,
            [ new CommandOption('-f', fileName), ]
        );
        if (namespace) {
            cmd.addOption(new CommandOption('--namespace', namespace));
        }
        return cmd;
    }

    static listProjects(): CommandText {
        return new CommandText('odo', 'list project', [
            new CommandOption('-o', 'json', false)
        ]);
    }

    static getDeployments(namespace: string): CommandText {
        return new CommandText(
            'oc get deployment',
            undefined,
            [
                new CommandOption('--namespace', namespace),
                new CommandOption('-o', 'json'),
            ]
        );
    }

    static deleteProject(name: string): CommandText {
        return new CommandText(
            'odo delete namespace',
            name, [
            new CommandOption('-f'),
            new CommandOption('-w'),
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

    static listComponents(project: string): CommandText {
        return new CommandText('odo list component',
            undefined, [
            new CommandOption('--namespace', project),
            new CommandOption('-o', 'json', false)
        ]
        );
    }

    static listRegistries(): CommandText {
        return new CommandText('odo preference view -o json');
    }

    static addRegistry(name: string, url: string, token: string): CommandText {
        const cTxt = new CommandText('odo preference add registry', `${name} ${url}`);
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

    static listCatalogOperatorBackedServices(): CommandText {
        return new CommandText('oc get csv -o jsonpath="{range .items[*]}{.metadata.name}{\'\\t\'}{.spec.version}{\'\\t\'}{.spec.displayName}{\'\\t\'}{.metadata.annotations.description}{\'\\t\'}{.spec.customresourcedefinitions.owned}{\'\\n\'}{end}"');
    }

    static printOcVersion(): CommandText {
        return new CommandText('oc version');
    }

    static addHelmRepo(): CommandText {
       return new CommandText('helm repo add openshift https://charts.openshift.io/');
    }

    static updateHelmRepo(): CommandText {
        return new CommandText('helm repo update');
     }

    static installHelmChart(name: string, chartName: string, version: string): CommandText {
        return new CommandText(`helm install ${name} openshift/${chartName} --version ${version}`);
    }

    static unInstallHelmChart(name: string): CommandText {
        return new CommandText(`helm uninstall ${name}`);
    }

    static printOcVersionJson(): CommandText {
        return new CommandText('oc version -ojson');
    }

    static listServiceInstances(namespace: string): CommandText {
        return new CommandText('odo list service',
            undefined, [
            new CommandOption('--namespace', namespace),
            new CommandOption('-o', 'json', false)
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
        return new CommandText('oc login',
            clusterURL, [
            new CommandOption('-u', username, true, true),
            new CommandOption('-p', passwd, true, true),
            new CommandOption('--insecure-skip-tls-verify')
        ]
        );
    }

    static odoLoginWithToken(clusterURL: string, ocToken: string): CommandText {
        return new CommandText('oc login',
            clusterURL, [
            new CommandOption('--token', ocToken),
            new CommandOption('--insecure-skip-tls-verify')
        ]
        );
    }

    static describeComponent(): CommandText {
        return new CommandText('odo', 'describe component');
    }

    static describeComponentJson(): CommandText {
        return Command.describeComponent().addOption(new CommandOption('-o', 'json', false));
    }

    static describeCatalogComponent(component: string, registry: string): CommandText {
        return new CommandText('odo',
            'registry', [
            new CommandOption('--details'),
            new CommandOption('--devfile', component),
            new CommandOption('--devfile-registry', registry),
            new CommandOption('-o', 'json', false),
        ]
        );
    }

    static showLog(platform?: string): CommandText {
        const result = new CommandText('odo', 'logs', [
            new CommandOption('--dev'),
        ]);
        if (platform) {
            result.addOption(new CommandOption('--platform', platform));
        }
        return result;
    }

    static showLogAndFollow(platform?: string): CommandText {
        return Command.showLog(platform).addOption(new CommandOption('--follow'));
    }

    @verbose
    static createLocalComponent(
        type = '', // will use empty string in case of undefined type passed in
        registryName: string,
        name: string,
        starter: string = undefined,
        useExistingDevfile = false,
        customDevfilePath = '',
        devfileVersion: string = undefined,
    ): CommandText {
        const cTxt = new CommandText('odo', 'init', [
            new CommandOption('--name', name)
        ]
        );
        if (type !== '') {
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
        if (customDevfilePath.length > 0) {
            cTxt.addOption(new CommandOption('--devfile-path', customDevfilePath, false));
        }
        if (devfileVersion) {
            cTxt.addOption(new CommandOption('--devfile-version', devfileVersion, false));
        }
        return cTxt;
    }

    static deleteContext(name: string): CommandText {
        return new CommandText('oc config delete-context', name);
    }

    static deleteCluster(name: string): CommandText {
        return new CommandText('oc config delete-cluster', `${name}`);
    }

    static deleteUser(name: string): CommandText {
        return new CommandText('oc config delete-user', name);
    }

    static showServerUrl(): CommandText {
        return new CommandText('oc whoami --show-server');
    }

    static getCurrentUserName(): CommandText {
        return new CommandText('oc whoami');
    }

    static getCurrentUserToken(): CommandText {
        return new CommandText('oc whoami -t');
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

    static setNamespace(namespace: string) {
        return new CommandText('odo set namespace', namespace);
    }

    static deleteComponentConfiguration(): CommandText {
        return new CommandText('odo delete component', undefined, [
            new CommandOption('--files'),
            new CommandOption('-f'),
        ]);
    }

    static canCreatePod(): CommandText {
        return new CommandText('oc auth can-i create pod');
    }
}
