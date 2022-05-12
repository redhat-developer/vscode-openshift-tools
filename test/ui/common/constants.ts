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
    compRegistries: 'Registries',
    watchSessions: 'Watch Sessions',
    debugSessions: 'Debug Sessions',
    devFileRegistry: 'DefaultDevfileRegistry',
};

export const BUTTONS = {
    login: 'Login',
    kubeContext: 'Select Kubernetes Context',
    addCluster: 'Add OpenShift Cluster',
    newComponent: 'New Component',
};

export const INPUTS = {
    newUrlQuickPick: 'Provide new URL...',
    credentialsQuickPick: 'Credentials',
    newUserQuickPick: 'Add new user...',
    newFolderQuickPick: 'Select workspace for component',
    yes: 'Yes',
    no: 'No',
};

export const MENUS = {
    newProject: 'New Project',
    delete: 'Delete',
    push: 'Push',
};

export const COMPONENTS = {
    nodejsDevfile: 'nodejs (devfile)',
    devfileComponent: (name: string) => `${name} (devfile)`,
    pushSuccess: 'Changes successfully pushed',
};

export const NOTIFICATIONS = {
    deleteProjectWarning: (projectName: string) =>
        `Do you want to delete Project '${projectName}'?`,
    projectDeleteSuccess: (projectName: string) => `Project '${projectName}' successfully deleted`,
    savePasswordPrompt: 'Do you want to save username and password?',
    loginSuccess: (cluster: string) => `Successfully logged in to '${cluster}'`,
};
