/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { workspace } from 'vscode';
import { Platform } from '../util/platform';

function verbose(_target: any, key: string, descriptor: any): void {
    let fnKey: string | undefined;
    let fn: Function | undefined;

    if (typeof descriptor.value === 'function') {
        fnKey = 'value';
        fn = descriptor.value;
    } else {
        throw new Error('not supported');
    }

    descriptor[fnKey] = function(...args: any[]): any {
        const v = workspace.getConfiguration('openshiftConnector').get('outputVerbosityLevel');
        const command = fn.apply(this, args);
        return command + (v > 0 ? ` -v ${v}` : '');
    };
}

export class Command {
    static printCatalogComponentImageStreamRefJson(name: string, namespace: string): string {
        return `oc get imagestream ${name} -n ${namespace} -o json`;
    }

    static listProjects(): string {
        return `odo project list -o json`;
    }

    @verbose
    static listApplications(project: string): string {
        return `odo application list --project ${project} -o json`;
    }

    static deleteProject(name: string): string {
        return `odo project delete ${name} -w -o json`;
    }

    @verbose
    static createProject(name: string): string {
        return `odo project create ${name}`;
    }

    static listComponents(project: string, app: string): string {
        return `odo list --app ${app} --project ${project} -o json`;
    }

    static listCatalogComponents(): string {
        return `odo catalog list components`;
    }

    static listCatalogComponentsJson(): string {
        return `${Command.listCatalogComponents()} -o json`;
    }

    static listCatalogServices(): string {
        return `odo catalog list services`;
    }

    static listCatalogServicesJson(): string {
        return `${Command.listCatalogServices()} -o json`;
    }

    static listStorageNames(): string {
        return `odo storage list -o json`;
    }

    static printOcVersion(): string {
        return 'oc version';
    }

    static listServiceInstances(project: string, app: string): string {
        return `odo service list -o json --project ${project} --app ${app}`;
    }

    static describeApplication(project: string, app: string): string {
        return `odo app describe ${app} --project ${project}`;
    }

    static deleteApplication(project: string, app: string): string {
        return `odo app delete ${app} --project ${project} -f`;
    }

    static printOdoVersion(): string {
        return 'odo version';
    }

    static printOdoVersionAndProjects(): string {
        return 'odo version && odo project list';
    }

    static odoLogout(): string {
        return `odo logout`;
    }

    static setOpenshiftContext(context: string): string {
        return `oc config use-context ${context}`;
    }

    static odoLoginWithUsernamePassword(
        clusterURL: string,
        username: string,
        passwd: string,
    ): string {
        const quote = Platform.OS === 'win32' ? `"` : `'`;
        return `odo login ${clusterURL} -u ${quote}${username}${quote} -p ${quote}${passwd}${quote} --insecure-skip-tls-verify`;
    }

    static odoLoginWithToken(clusterURL: string, ocToken: string): string {
        return `odo login ${clusterURL} --token=${ocToken} --insecure-skip-tls-verify`;
    }

    @verbose
    static createStorage(storageName: string, mountPath: string, storageSize: string): string {
        return `odo storage create ${storageName} --path=${mountPath} --size=${storageSize}`;
    }

    static deleteStorage(storage: string): string {
        return `odo storage delete ${storage} -f`;
    }

    static describeStorage(storage: string): string {
        return `odo storage describe ${storage}`;
    }

    static waitForStorageToBeGone(project: string, app: string, storage: string): string {
        return `oc wait pvc/${storage}-${app}-pvc --for=delete --namespace ${project}`;
    }

    static undeployComponent(project: string, app: string, component: string): string {
        return `odo delete ${component} -f --app ${app} --project ${project}`;
    }

    static deleteComponent(project: string, app: string, component: string): string {
        return `odo delete ${component} -f --app ${app} --project ${project} --all`;
    }

    static describeComponentNoContext(project: string, app: string, component: string): string {
        return `odo describe ${component} --app ${app} --project ${project}`;
    }

    static describeComponentNoContextJson(project: string, app: string, component: string): string {
        return `${this.describeComponentNoContext(project, app, component)} -o json`;
    }

    static describeComponent(): string {
        return `odo describe`;
    }

    static describeComponentJson(): string {
        return `${Command.describeComponent()} -o json`;
    }

    static describeService(service: string): string {
        return `odo catalog describe service ${service}`;
    }

    static describeUrl(url: string): string {
        return `odo url describe ${url}`;
    }

    static showLog(): string {
        return `odo log`;
    }

    static showLogAndFollow(): string {
        return `odo log -f`;
    }

    static listComponentPorts(project: string, app: string, component: string): string {
        return `oc get service ${component}-${app} --namespace ${project} -o jsonpath="{range .spec.ports[*]}{.port}{','}{end}"`;
    }

    static linkComponentTo(
        project: string,
        app: string,
        component: string,
        componentToLink: string,
        port?: string,
    ): string {
        return `odo link ${componentToLink} --project ${project} --app ${app} --component ${component} --wait${
            port ? ` --port ${port}` : ''
        }`;
    }

    static linkServiceTo(
        project: string,
        app: string,
        component: string,
        serviceToLink: string,
    ): string {
        return `odo link ${serviceToLink} --project ${project} --app ${app} --component ${component} --wait --wait-for-target`;
    }

    @verbose
    static pushComponent(configOnly = false): string {
        return `odo push${configOnly ? ' --config' : ''}`;
    }

    @verbose
    static watchComponent(): string {
        return `odo watch`;
    }

    @verbose
    static createLocalComponent(
        project: string,
        app: string,
        type: string,
        version: string,
        name: string,
        folder: string,
    ): string {
        return `odo create ${type}:${version} ${name} --context ${folder} --app ${app} --project ${project}`;
    }

    @verbose
    static createGitComponent(
        project: string,
        app: string,
        type: string,
        version: string,
        name: string,
        git: string,
        ref: string,
    ): string {
        return `odo create ${type}:${version} ${name} --git ${git} --ref ${ref} --app ${app} --project ${project}`;
    }

    @verbose
    static createBinaryComponent(
        project: string,
        app: string,
        type: string,
        version: string,
        name: string,
        binary: string,
        context: string,
    ): string {
        return `odo create ${type}:${version} ${name} --binary ${binary} --app ${app} --project ${project} --context ${context}`;
    }

    @verbose
    static createService(
        project: string,
        app: string,
        template: string,
        plan: string,
        name: string,
    ): string {
        return `odo service create ${template} --plan ${plan} ${name} --app ${app} --project ${project} -w`;
    }

    static deleteService(project: string, app: string, name: string): string {
        return `odo service delete ${name} -f --project ${project} --app ${app}`;
    }

    static getServiceTemplate(project: string, service: string): string {
        return `oc get ServiceInstance ${service} --namespace ${project} -o jsonpath="{$.metadata.labels.app\\.kubernetes\\.io/name}"`;
    }

    static waitForServiceToBeGone(project: string, service: string): string {
        return `oc wait ServiceInstance/${service} --for delete --namespace ${project}`;
    }

    @verbose
    static createComponentCustomUrl(name: string, port: string, secure = false): string {
        return `odo url create ${name} --port ${port} ${secure ? '--secure' : ''}`;
    }

    static getComponentUrl(): string {
        return `odo url list -o json`;
    }

    static deleteComponentUrl(name: string): string {
        return `odo url delete -f ${name} --now`;
    }

    static getComponentJson(): string {
        return `odo describe -o json`;
    }

    static unlinkComponents(
        project: string,
        app: string,
        comp1: string,
        comp2: string,
        port: string,
    ): string {
        return `odo unlink --project ${project} --app ${app} ${comp2} --port ${port} --component ${comp1}`;
    }

    static unlinkService(project: string, app: string, service: string, comp: string): string {
        return `odo unlink --project ${project} --app ${app} ${service} --component ${comp}`;
    }

    static getclusterVersion(): string {
        return `oc get clusterversion -ojson`;
    }

    static showServerUrl(): string {
        return `oc whoami --show-server`;
    }

    static showConsoleUrl(): string {
        return `oc get configmaps console-public -n openshift-config-managed -o json`;
    }
}
