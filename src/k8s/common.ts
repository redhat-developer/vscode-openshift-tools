import * as Odo from '../odo';
import { QuickPickItem, window } from "vscode";

function convertItemToQuickPick(item: any) {
    item.label = item.metadata.name;
}

export async function getQuickPicks(cmd: string, errorMessage: string, converter: (item: any) => void = convertItemToQuickPick): Promise<QuickPickItem[]> {
    const result = await Odo.getInstance().execute(cmd);
    const json: JSON = JSON.parse(result.stdout);
    if (json['items'].length === 0) {
        throw Error(errorMessage);
    }
    json['items'].forEach((item: any) => {
       converter(item);
    });
    return json['items'];
}

export async function selectResourceByName(config: Promise<QuickPickItem[]> | QuickPickItem[], placeHolderText: string): Promise<string> {
    const resource: any = await window.showQuickPick(config, {placeHolder: placeHolderText});
    return resource ? resource.label : null;
}