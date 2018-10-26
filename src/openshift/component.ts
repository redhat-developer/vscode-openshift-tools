import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject } from '../odo';
import * as vscode from 'vscode';
import * as progress from '../progress';
import opn = require('opn');
import { ChildProcess } from 'child_process';

export class Component extends OpenShiftItem {
    static async create(context: OpenShiftObject): Promise<string> {
        // should use QuickPickItem with label and description
        const sourceTypes: vscode.QuickPickItem[] = [
        {
            label: 'Git Repository',
            description: 'Use an existing git repository as a source for the component'
        },
        {
            label: 'Workspace Directory',
            description: 'Use workspace directory as a source for the component'
        }];
        const componentSource = await vscode.window.showQuickPick(sourceTypes, {
            placeHolder: "Select source type for component"
        });
        if (componentSource.label === 'Git Repository') {
            return Component.createGit(context);
        } else {
            return Component.createLocal(context);
        }
    }

    static async del(context: OpenShiftObject): Promise<string> {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        const value = await vscode.window.showWarningMessage(`Are you sure you want to delete component '${context.getName()}\'`, 'Yes', 'Cancel');
        if (value === 'Yes') {
            return Promise.resolve()
                .then(() => Component.odo.execute(`odo project set ${project.getName()} && odo app set ${app.getName()} && odo delete ${context.getName()} -f`))
                .then(() => {
                    Component.explorer.refresh(context.getParent());
                    return `Component '${context.getName()}' successfully deleted`;
                })
                .catch((err) => { return Promise.reject(`Failed to delete component with error '${err}'`); });
        }
        return Promise.resolve(null);
    }

    static describe(context: OpenShiftObject): void {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        Component.odo.executeInTerminal(`odo project set ${project.getName()} && odo app set ${app.getName()} && odo describe ${context.getName()}`, process.cwd());
    }

    static log(context: OpenShiftObject): void {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        Component.odo.executeInTerminal(`odo project set ${project.getName()} && odo app set ${app.getName()} && odo log ${context.getName()}`, process.cwd());
    }

    static followLog(context: OpenShiftObject) {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        Component.odo.executeInTerminal(`odo project set ${project.getName()} && odo app set ${app.getName()} && odo log ${context.getName()} -f`, process.cwd());
    }

    static async push(context: OpenShiftObject): Promise<string> {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();

        return progress.execWithProgress({
            cancellable: false,
            location: vscode.ProgressLocation.Notification,
            title: `Pushing latest changes for component '${context.getName()}'`
        }, [{command: `odo project set ${project.getName()} && odo app set ${app.getName()} && odo component set  ${context.getName()} && odo push ${context.getName()}`, increment: 100}
        ], Component.odo)
        .then(() => `Successfully pushed changes for '${context.getName()}'`);
    }

    static watch(context: OpenShiftObject): void {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        Component.odo.executeInTerminal(`odo project set ${project.getName()}; odo app set ${app.getName()}; odo component set ${context.getName()}; odo watch ${context.getName()};`, process.cwd());
    }

    static async openUrl(context: OpenShiftObject): Promise<ChildProcess> {
        const app: OpenShiftObject = context.getParent();
        const routeCheck = await Component.odo.execute(`oc get route -o jsonpath="{range .items[?(.metadata.labels.app\\.kubernetes\\.io/component-name=='${context.getName()}')]}{.spec.host}{end}"`);
        let value = 'Create';
        if (routeCheck.stdout.trim() === '') {
            value = await vscode.window.showInformationMessage(`No URL for component '${context.getName()}\' in application '${app.getName()}\'. Do you want to create a route and open it?`, 'Create', 'Cancel');
            if (value === 'Create') {
                await vscode.commands.executeCommand('openshift.url.create', context);
            }
        }
        if (value === 'Create') {
            const hostName = await Component.odo.execute(`oc get route -o jsonpath="{range .items[?(.metadata.labels.app\\.kubernetes\\.io/component-name=='${context.getName()}')]}{.spec.host}{end}"`);
            const checkTls = await Component.odo.execute(`oc get route -o jsonpath="{range .items[?(.metadata.labels.app\\.kubernetes\\.io/component-name=='${context.getName()}')]}{.spec.tls.termination}{end}"`);
            const tls = checkTls.stdout.trim().length === 0  ? "http://" : "https://";
            return opn(`${tls}${hostName.stdout}`);
        }
    }

    static openshiftConsole(context: OpenShiftObject): Promise<ChildProcess> {
        return opn(context.getName());
    }

    private static async createLocal(context: OpenShiftObject): Promise<string> {
        try {
            const folder = await vscode.window.showWorkspaceFolderPick({
                placeHolder: 'Select the target workspace folder'
            });

            if (!folder) return Promise.resolve(null);

            const componentName = await vscode.window.showInputBox({
                prompt: "Component name",
                validateInput: (value: string) => {
                    if (value.trim().length === 0) {
                        return 'Empty component name';
                    }
                }
            });

            if (!componentName) return Promise.resolve(null);

            const componentTypeName = await vscode.window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type"});

            if (!componentTypeName) return Promise.resolve(null);

            const componentTypeVersion = await vscode.window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type Version"});

            if (!componentTypeVersion) return Promise.resolve(null);

            return progress.execWithProgress({
                cancellable: false,
                location: vscode.ProgressLocation.Notification,
                title: `Creating new component '${componentName}'`
            }, [{command: `odo project set ${context.getParent().getName()} && odo app set ${context.getName()} && odo create ${componentTypeName}:${componentTypeVersion} ${componentName} --local ${folder.uri.fsPath}`, increment: 50},
                {command: `odo project set ${context.getParent().getName()} && odo app set ${context.getName()} && odo component set ${componentName} && odo push --local ${folder.uri.fsPath}`, increment: 50}
            ], Component.odo).then(() => {
                Component.explorer.refresh(context);
                return `Component '${componentName}' successfully created`;
            });

        } catch (e) {
            return Promise.reject(e);
        }
    }

    private static async createGit(context: OpenShiftObject): Promise<string> {
        try {
            const repoURI = await vscode.window.showInputBox({prompt: 'Git repository URI', validateInput:
                (value: string) => {
                    if (value.trim().length === 0) {
                        return 'Empty Git repository URL';
                    }
                }
            });

            if (!repoURI) return Promise.resolve(null);

            const componentName = await vscode.window.showInputBox({prompt: "Component name", validateInput: (value: string) => {
                if (value.trim().length === 0) {
                    return 'Empty component name';
                }
            }});

            if (!componentName) return Promise.resolve(null);

            const componentTypeName = await vscode.window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type"});

            if (!componentTypeName) return Promise.resolve(null);

            const componentTypeVersion = await vscode.window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type Version"});

            if (!componentTypeVersion) return Promise.resolve(null);

            vscode.window.showInformationMessage('Do you want to clone git repository for created component?', 'Yes', 'No').then((value) => {
                value === 'Yes' && vscode.commands.executeCommand('git.clone', repoURI);
            });

            return progress.execWithProgress({
                cancellable: false,
                location: vscode.ProgressLocation.Notification,
                title: `Creating new component '${componentName}'`
            }, [{command: `odo project set ${context.getParent().getName()} && odo app set ${context.getName()} && odo create ${componentTypeName}:${componentTypeVersion} ${componentName} --git ${repoURI}`, increment: 100}
            ], Component.odo).then(() => {
                Component.explorer.refresh(context);
                return `Component '${componentName}' successfully created`;
            });

        } catch (e) {
            return Promise.reject(e);
        }
    }
}