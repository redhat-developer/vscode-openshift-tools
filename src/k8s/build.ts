import { window } from "vscode";

export function showLog(context: any) {
    window.showInformationMessage(`oc log ${context.impl.id}`);
}

export function followLog(context: any) {
    window.showInformationMessage(`oc log -f ${context.impl.id}`);
}