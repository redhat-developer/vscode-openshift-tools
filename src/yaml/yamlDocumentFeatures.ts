/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubernetesObject } from '@kubernetes/client-node';
import { load as loadYaml } from 'js-yaml';
import * as vscode from 'vscode';

const YAML_SELECTOR: vscode.DocumentSelector = {
    language: 'yaml',
    scheme: 'file'
};

const RANGE: vscode.Range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1));

export function registerYamlHandlers(): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];
    disposables.push(
        vscode.languages.registerCodeLensProvider(YAML_SELECTOR, new YamlCodeLensProvider()));
    return disposables;
}

class YamlCodeLensProvider implements vscode.CodeLensProvider {
    provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {

        try {

            const objectTexts: string[] = document.getText().split(/(?:^---\r?\n)|(?:\n---\r?\n)/).filter(text => text && text.length > 0);

            for (const objectText of objectTexts) {
                const yaml = loadYaml(objectText) as KubernetesObject;

                // heuristic to check if it's a k8s yaml
                if (!yaml.apiVersion || !yaml.kind || !yaml.metadata) {
                    return [];
                }
            }

        } catch (e) {
            return [];
        }

        return [
            {
                isResolved: true,
                range: RANGE,
                command: {
                    command: 'openshift.create',
                    title: 'Apply YAML to cluster',
                    tooltip: 'Performs `kubectl apply -f` on this file'
                }
            },
            {
                isResolved: true,
                range: RANGE,
                command: {
                    command: 'openshift.delete',
                    title: 'Delete YAML from cluster',
                    tooltip: 'Performs `kubectl delete -f` on this file'
                }
            }
        ];
    }
}
