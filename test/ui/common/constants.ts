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
};

export const BUTTONS = {
    login: 'Login',
    kubeContext: 'Select Kubernetes Context',
    addCluster: 'Add OpenShift Cluster',
    newComponent: 'Create Component',
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

export const COMMANDS = [
    'About',
    'Create',
    'Create Service ...',
    'Debug Component',
    'Delete Build',
    'Delete Component',
    'Delete Project',
    'Delete Replica',
    'Delete Service',
    'Deploy',
    'Describe Component',
    'Focus on Application Explorer View',
    'Focus on Components View',
    'Focus on Debug Sessions View',
    'Follow Component Log',
    'Follow Log',
    'Get Started',
    'Import from Git',
    'Log out',
    'Login into Cluster using URL and token from clipboard',
    'Login into Cluster with credentials',
    'Login into Cluster with token',
    'New Component',
    'New Project',
    'New Service',
    'Open Console Dashboard for Current Cluster',
    'Open in Browser',
    'OpenShift',
    'Print OKD Client Tool Version',
    'Rebuild',
    'Refresh Application Explorer View',
    'Refresh Components Types View',
    'Refresh Components View',
    'Report Extension Issue on GitHub',
    'Set Active Project',
    'Show Build\'s Log',
    'Show Component Log',
    'Show DeploymentConfig\'s Log',
    'Show Dev Terminal',
    'Show Output Channel',
    'Show Replica\'s Log',
    'Start Build',
    'Start Dev',
    'Stop Dev',
    'Stop OpenShift Local',
    'Switch Contexts',
    'Undeploy',
    'Use Project',
    'Welcome'
];