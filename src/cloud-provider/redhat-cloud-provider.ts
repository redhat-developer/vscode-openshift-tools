/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as k8s from 'vscode-kubernetes-tools-api';
import * as vscode from 'vscode';
import { vsCommand } from '../vscommand';
import { createSandboxAPI, SBSignupResponse } from '../openshift/sandbox';
import ClusterViewLoader from '../webview/cluster/clusterViewLoader';

const sandboxAPI = createSandboxAPI();

class RedHatCloudItem extends vscode.TreeItem{

}

class RedHatTreeDataProvier implements vscode.TreeDataProvider<RedHatCloudItem> {
    private eventEmitter: vscode.EventEmitter<RedHatCloudItem> = new vscode.EventEmitter<RedHatCloudItem>()
    readonly onDidChangeTreeData: vscode.Event<RedHatCloudItem> = this.eventEmitter.event

    getTreeItem(element: RedHatCloudItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element
    }

    getChildren(element?: RedHatCloudItem): vscode.ProviderResult<RedHatCloudItem[]> {
        if(!element){
            return this.getTopLevelItems();
        }
        return [];
    }

    getParent?(element: RedHatCloudItem): unknown {
        throw new Error('Method not implemented.');
    }

    resolveTreeItem?(item: vscode.TreeItem, element: unknown, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TreeItem> {
        throw new Error('Method not implemented.');
    }

    private async getTopLevelItems(): Promise<RedHatCloudItem[]> {
        const sessionCheck = await vscode.authentication.getSession('redhat-account-auth', ['openid'], { createIfNone: false });
        if(sessionCheck) {
            const sandboxItem = await this.buildSandboxItem();
            sandboxItem.iconPath
            const openshiftLocal = new RedHatCloudItem('OpenShift Local');
            openshiftLocal.tooltip = 'OpenShift Local'
            openshiftLocal.command = {
                command:'openshift.local.open.setup',
                title: 'Install OpenShift Local',
            }
            return [sandboxItem,openshiftLocal];
        }
        const loginItem = new RedHatCloudItem('Sign in to Red Hat');
        loginItem.iconPath = new vscode.ThemeIcon('account');
        loginItem.tooltip = 'Sign in to Red Hat';
        loginItem.command = {
           command: 'cloud.redhat.login',
           title: 'Sign in to Red Hat',
        }

        const signUpItem = new RedHatCloudItem('Create Red Hat Account');
        signUpItem.tooltip = 'Create Red Hat Account';
        signUpItem.iconPath = new vscode.ThemeIcon('add');
        signUpItem.command = {
            command: '_openshift.open.signup',
            title: 'Create Red Hat Account',
            tooltip: 'Create Red Hat Account'
        }
        return [loginItem, signUpItem];

    }

    private async buildSandboxItem() {
        const signupStatus = await RedHatTreeDataProvier.getSandboxSignupStatus()
        const sandboxItem = new RedHatCloudItem('Developer Sandbox');
        sandboxItem.tooltip = 'Developer Sandbox'

        if (!signupStatus) {
            sandboxItem.contextValue = 'openshift.sandbox.status.none';
        }
        else if (signupStatus.status.ready) {
            sandboxItem.contextValue = 'openshift.sandbox.status.ready';
        }
        return sandboxItem;
    }

    @vsCommand('openshift.sandbox.signup')
    static async signupForSandbox() : Promise<string> {
        const authSession = await vscode.authentication.getSession('redhat-account-auth', ['openid'], { createIfNone: false });
        if(authSession){
            // eslint-disable-next-line dot-notation
            const signupResponse = await sandboxAPI.signUp(authSession['idToken'] as string);
            if( !signupResponse ){
                return 'Sign up request for OpenShift Sandbox failed, please try again.'
            }
            await RedHatTreeDataProvier.refreshView();

        }
    }

    @vsCommand('openshift.local.open.setup')
    static async openCrCWizard(): Promise<void> {
        await ClusterViewLoader.loadView('Add OpenShift Cluster', 'crc');
    }

    @vsCommand('cloud.redhat.login', false)
    static async loginToRedHatCloud(): Promise<void> {
        const session  = await vscode.authentication.getSession('redhat-account-auth', ['openid'], { createIfNone: true });
        if(session ){
            await RedHatTreeDataProvier.refreshView();
        }
    }

    @vsCommand('_openshift.open.signup', false)
    static async signupForRedHatAccount(): Promise<void> {
        return vscode.commands.executeCommand('vscode.open', 'https://red.ht/3MkQ54W');
    }

    @vsCommand('openshift.sandbox.open.dashboard', false)
    static async openDashboard(): Promise<void> {
        const sandboxStatus = await RedHatTreeDataProvier.getSandboxSignupStatus();
        if(sandboxStatus)
        {
            return vscode.commands.executeCommand('vscode.open', sandboxStatus.consoleURL);
        }
    }

    private static async getSandboxSignupStatus() : Promise<SBSignupResponse | undefined> {
        const authSession = await vscode.authentication.getSession('redhat-account-auth', ['openid'], { createIfNone: false });
        if(authSession) {
            // eslint-disable-next-line dot-notation
            return await sandboxAPI.getSignUpStatus(authSession['idToken'] as string);
        }
        return undefined
    }
    private static async refreshView() {
        const cloudExplorer = await k8s.extension.cloudExplorer.v1;
        if (cloudExplorer.available) {
            cloudExplorer.api.refresh();
        }
    }

}

class RedHatCloudProvider implements k8s.CloudExplorerV1.CloudProvider {
    getKubeconfigYaml(cluster: any): Promise<string> {
        throw new Error('Method not implemented.');
    }
    readonly cloudName = 'Red Hat OpenShift'
    readonly treeDataProvider = new RedHatTreeDataProvier();

}

export const REDHAT_CLOUD_PROVIDER = new RedHatCloudProvider();
