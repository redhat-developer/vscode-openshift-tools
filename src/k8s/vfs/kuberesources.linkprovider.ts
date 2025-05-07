/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as _ from 'lodash';
import * as querystring from 'querystring';
import * as vscode from 'vscode';
import { DocumentLinkProvider, Uri } from 'vscode';
import * as jl from './json-locator';
import * as kuberesources from './kuberesources';
import { K8S_RESOURCE_SCHEME, K8S_RESOURCE_SCHEME_READONLY, getOutputFormat, helmfsUri, kubefsUri } from './kuberesources.utils';
import { MappingItem, Node, NodeProvider } from './locator-util';
import * as yl from './yaml-locator';

// >>> URI Cache >>>

// A mapping of URIs to cached documents - it's needed to prevent openning multiple editors
// for the same document URI (if URI has "nonce" param in its query)
let uriCache: { [key: string]: Uri } = {};

function ensureCache(uri: Uri): Uri {
    const k: string = uri.toString(true).replace(/&_=[0-9]+/g, '');
    if (!uriCache[k]) {
        uriCache[k] = uri;
    }
    return uriCache[k];
}

function cacheEditingUris() {
    vscode.workspace.textDocuments.map((doc) => doc.uri)
        .filter((uri) => [K8S_RESOURCE_SCHEME, K8S_RESOURCE_SCHEME_READONLY].find((s) => uri.scheme))
        .forEach(ensureCache);
}
// <<< URI Cache <<<

export class KubernetesResourceLinkProvider implements DocumentLinkProvider {
    provideDocumentLinks(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.DocumentLink[]> {
        const sourceKind = k8sKind(document);
        const docs = getParsedDocuments(document);
        const leaves = getLeafNodes(docs);

        try {
            uriCache = {}; // Drop the saved values, if any
            cacheEditingUris();
            return leaves.choose((l) => getLink(document, sourceKind, l));
        } finally {
            uriCache = {}; // Drop the saved values, if any
        }
    }
}

export function getParsedDocuments(document: vscode.TextDocument): NodeProvider[] {
    const df = getDocumentFormat(document);
    const docs = (df === 'yaml' || df === 'yml') ?
            yl.yamlLocator.getYamlDocuments(document)
                : df === 'json' ? jl.jsonLocator.getJsonDocuments(document) : [];
    return docs;
}

function getDocumentFormat(document: vscode.TextDocument): string | undefined {
    const path = document.uri.path;
    const sepIndex = path.indexOf('.');
    return sepIndex >= 0 ? path.substring(sepIndex + 1).toLocaleLowerCase() : undefined;
}

export function getLeafNodes(docs: NodeProvider[]): Node[] {
    const rootNodes = _.flatMap(docs, (d) => d.nodes);
    const nonRootNodes = _.flatMap(rootNodes, (n) => descendants(n));
    const allNodes = rootNodes.concat(nonRootNodes);
    const leafNodes = allNodes.filter((n) => isLeaf(n));
    return leafNodes;
}

function getLink(document: vscode.TextDocument, sourceKind: string, node: Node): vscode.DocumentLink | undefined {
    if (yl.isMappingItem(node as yl.YamlNode)) {
        const mi = node as yl.YamlMappingItem;
        return getLinkFromPair(document, sourceKind, mi);
    }
    if (jl.isProperty(node as jl.JsonNode)) {
        const m = node as jl.JsonProperty;
        return getLinkFromPair(document, sourceKind, m);
    }
    return undefined;
}

export function range(document: vscode.TextDocument, node: MappingItem): vscode.Range {
    return new vscode.Range(
        document.positionAt(node.value.startPosition),
        document.positionAt(node.value.endPosition)
    );
}

export function keyRange(document: vscode.TextDocument, node: MappingItem): vscode.Range {
    return new vscode.Range(
        document.positionAt(node.key.startPosition),
        document.positionAt(node.key.endPosition)
    );
}

function descendants(node: Node): Node[] {
    const direct = children(node);
    const indirect = direct.map((n) => descendants(n));
    const all = direct.concat(...indirect);
    return all;
}

function children(node: Node): Node[] {
    // YamlNode children
    if (yl.isMapping(node as yl.YamlNode)) {
        const map = node as yl.YamlMap;
        return map.mappings;
    } else if (yl.isSequence(node as yl.YamlNode)) {
        const sequence = node as yl.YamlSequence;
        return sequence.items;
    } else if (yl.isMappingItem(node as yl.YamlNode)) {
        const mappingItem = node as yl.YamlMappingItem;
        if (yl.isMapping(mappingItem.value) || yl.isSequence(mappingItem.value)) {
            return [mappingItem.value];
        }
        return [];
    }

    // JsonNode children
    if (jl.isObject(node as jl.JsonNode)) {
        const obj = node as jl.JsonObject;
        return obj.children;
    } else if (jl.isArray(node as jl.JsonNode)) {
        const arr = node as jl.JsonArray;
        return arr.items;
    } else if (jl.isProperty(node as jl.JsonNode)) {
        const member = node as jl.JsonProperty;
        if (jl.isObject(member.value)) {
            return member.value.children;
        } else if (jl.isArray(member.value)) {
            return member.value.items;
        }
        return [];
    }

    return [];
}

function isLeaf(node: Node): boolean {
    if (yl.isMappingItem(node as yl.YamlNode)) {
        const mi = node as yl.YamlMappingItem;
        return mi.value.kind === 'SCALAR';
    }

    if (jl.isProperty(node as jl.JsonNode)) {
        const m = node as jl.JsonProperty;
        return jl.isLiteral(m.value);
    }

    return false;
}

function key(node: Node): string | undefined {
    if (node) {
        if (yl.isMappingItem(node as yl.YamlNode)) {
            const mi = node as yl.YamlMappingItem;
            return mi.key.raw;
        }
        if (jl.isProperty(node as jl.JsonNode)) {
            const p = node as jl.JsonProperty;
            return p.key.raw;
        }
    }
    return undefined;
}

function parentKey(node: Node): string | undefined {
    const parent = node.parent;
    if (!parent) {
        return undefined;
    }
    if (parent.parent) {
        let parentPair = undefined;
        let parentKey = undefined;
        if (yl.isMapping(parent.parent as yl.YamlNode)) {
            parentPair = (parent.parent as yl.YamlMap).mappings.find((mi) => mi.value === parent);  // safe because we are looking for our own mapping
        } else if (jl.isProperty(parent.parent as jl.JsonNode)) {
            parentPair = (parent.parent as jl.JsonProperty).value === parent ? parent.parent : undefined;
        }

        parentKey = key(parentPair);
        if (parentKey) {
            return parentKey;
        }
    }
    return parentKey(parent);
}

function siblings(node: Node): MappingItem[] {
    const parent = node.parent;
    if (parent) {
        if (yl.isMapping(parent as yl.YamlNode)) {
            const m = parent as yl.YamlMap;
            return m.mappings;
        }

        if (jl.isObject(parent as jl.JsonNode)) {
            const obj = parent as jl.JsonObject;
            return obj.children.filter((c) => jl.isProperty(c));
        }
    }
    return [];
}

function sibling(node: Node, name: string): string | undefined {
    return siblings(node).filter((n) => n.key.raw === name)
                         .map((n) => n.value.raw)[0];
}

function getLinkFromPair(document: vscode.TextDocument, sourceKind: string, node: MappingItem): vscode.DocumentLink | undefined {
    const uri = getLinkUri(sourceKind, node);
    if (!uri) {
        return undefined;
    }
    return new vscode.DocumentLink(range(document, node), ensureCache(uri));
}

function getLinkUri(sourceKind: string, node: MappingItem): vscode.Uri | undefined {
    // Things that apply to all source resource types
    const k = key(node);
    if (k === 'release' && parentKey(node) === 'labels') {
        return helmfsUri(node.value.raw, undefined);
    } else if (k === 'namespace' && parentKey(node) === 'metadata') {
        return kubefsUri(null, `ns/${node.value.raw}`, getOutputFormat());
    } else if (k === 'name' && parentKey(node) === 'ownerReferences') {
        const ownerKind = k8sKindFromManifestKind(sibling(node, 'kind'));
        if (ownerKind) {
            return kubefsUri(k8sNamespaceFromMetadata(node), `${ownerKind}/${node.value.raw}`, getOutputFormat());
        }
    }

    // Source=type-specific navigation
    switch (sourceKind) {
        case kuberesources.allKinds.deployment.abbreviation:
            return getLinkUriFromDeployment(node);
        case kuberesources.allKinds.persistentVolume.abbreviation:
            return getLinkUriFromPV(node);
        case kuberesources.allKinds.persistentVolumeClaim.abbreviation:
            return getLinkUriFromPVC(node);
        default:
            return undefined;
    }
}

function getLinkUriFromDeployment(node: MappingItem): vscode.Uri | undefined {
    const k = key(node);
    if (k === 'claimName' && parentKey(node) === 'persistentVolumeClaim') {
        return kubefsUri(null, `pvc/${node.value.raw}`, getOutputFormat());
    } else if (k === 'name') {
        const pk = parentKey(node);
        if (pk === 'configMap') {
            return kubefsUri(null, `cm/${node.value.raw}`, getOutputFormat());
        } else if (pk === 'secretKeyRef') {
            return kubefsUri(null, `secrets/${node.value.raw}`, getOutputFormat());
        }
    }
    return undefined;
}

function getLinkUriFromPV(node: MappingItem): vscode.Uri | undefined {
    const k = key(node);
    if (k === 'storageClassName') {
        return kubefsUri(null, `sc/${node.value.raw}`, getOutputFormat());
    } else if (k === 'name' && parentKey(node) === 'claimRef') {
        return kubefsUri(sibling(node, 'namespace'), `pvc/${node.value.raw}`, getOutputFormat());
    }
    return undefined;
}

function getLinkUriFromPVC(node: MappingItem): vscode.Uri | undefined {
    const k = key(node);
    if (k === 'storageClassName') {
        return kubefsUri(null, `sc/${node.value.raw}`, getOutputFormat());
    } else if (k === 'volumeName') {
        return kubefsUri(null, `pv/${node.value.raw}`, getOutputFormat());
    }
    return undefined;
}

function k8sKind(document: vscode.TextDocument): string {
    const query = querystring.parse(document.uri.query);
    const k8sid = query.value as string;
    const kindSepIndex = k8sid.indexOf('/');
    return k8sid.substring(0, kindSepIndex);
}

function k8sKindFromManifestKind(manifestKind: string | undefined): string | undefined {
    if (!manifestKind) {
        return undefined;
    }
    const resourceKind = kuberesources.findKind(manifestKind);
    return resourceKind ? resourceKind.abbreviation : undefined;
}

function k8sNamespaceFromMetadata(node: Node): string | null {
    // Find parent key === 'metadata'
    const parent = node.parent;
    if (!parent) {
        return null;
    }

    // Find MappingItem or Property
    if (parent.parent) {
        let nsMappingItem: MappingItem = undefined;
        if (yl.isMapping(parent.parent as yl.YamlNode)) {
            if (yl.isMapping(parent.parent.parent as yl.YamlNode)) {
                const pmi = (parent.parent.parent as yl.YamlMap).mappings.find((mi) => mi.key.raw === 'metadata');
                if (pmi) {
                    nsMappingItem = (parent.parent as yl.YamlMap).mappings.find((mi) => mi.key.raw === 'namespace');
                }
            }
        } else if (jl.isProperty(parent.parent as jl.JsonNode)) {
            const p = parent.parent as jl.JsonProperty;
            if (p.key.raw === 'metadata') {
                nsMappingItem = descendants((parent.parent as jl.JsonProperty).value)
                    .find((c) => jl.isProperty(c) && c.key.raw === 'namespace') as jl.JsonProperty;
            }
        }
        if (nsMappingItem) {
            return nsMappingItem.value.raw;
        }
    }
    return k8sNamespaceFromMetadata(parent);
}