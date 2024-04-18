/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export const VIEWS = {
    extensions: 'Extensions',
    installed: 'Installed',
    openshift: 'OpenShift',
    appExplorer: 'Application Explorer',
    components: 'Components',
    compRegistries: 'Devfile Registries',
    watchSessions: 'Watch Sessions',
    debugSessions: 'Debug Sessions',
    devFileRegistry: 'DefaultDevfileRegistry',
    serverlessFunctions: 'Serverless Functions',
};

export const BUTTONS = {
    login: 'Login',
    kubeContext: 'Select Kubernetes Context',
    addCluster: 'Add OpenShift Cluster',
    newComponent: 'Create Component',
};

export const ACTIONS = {
    switchContexts: 'Switch Contexts',
}

export const INPUTS = {
    newUrlQuickPick: 'Provide new URL...',
    credentialsQuickPick: 'Credentials',
    newUserQuickPick: 'Add new user...',
    newFolderQuickPick: 'Select workspace for component',
    yes: 'Yes',
    no: 'No',
    logout: 'Logout',
};

export const MENUS = {
    newProject: 'New Project',
    delete: 'Delete',
    deleteProject: 'Delete Project',
    bindService: 'Bind Service',
    startDev: 'Start Dev',
};

export const COMPONENTS = {
    nodejsDevfile: 'nodejs/DefaultDevfileRegistry',
    devfileComponent: (name: string) => `${name} (devfile)`,
    devStarted: 'Ctrl+c',
};

export const NOTIFICATIONS = {
    deleteProjectWarning: (projectName: string) =>
        `Do you want to delete Project '${projectName}'?`,
    projectDeleteSuccess: (projectName: string) => `Project '${projectName}' successfully deleted`,
    savePasswordPrompt: 'Do you want to save username and password?',
    loginSuccess: (cluster: string) => `Successfully logged in to '${cluster}'`,
    doYouWantLogOut: 'Do you want to logout of cluster?',
    logoutSuccess: 'Successfully logged out. Do you want to login to a new cluster'
};
