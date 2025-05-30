/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import $RefParser from '@apidevtools/json-schema-ref-parser';
import { findNodeAtLocation, getNodeValue, Node, parseTree } from 'jsonc-parser';
import * as _ from 'lodash';
import { Diagnostic, DiagnosticSeverity, FileStat, FileType, Range, TextDocument, Uri, workspace } from 'vscode';
import { Document, isMap, isPair, isScalar, isSeq, Pair, parse, ParsedNode, parseDocument, stringify } from 'yaml';
import { CommandOption, CommandText } from '../../base/command';
import { CliChannel, ExecutionContext } from '../../cli';
import { Oc } from '../../oc/ocWrapper';
import { YAML_STRINGIFY_OPTIONS } from '../../util/utils';

export const K8S_RESOURCE_SCHEME = 'osmsx'; // Changed from 'k8smsx' to 'osmsx' to not make a conflict with k8s extension
export const K8S_RESOURCE_SCHEME_READONLY = 'osmsxro'; // Changed from 'k8smsxro' to 'osmsxro' to not make a conflict with k8s extension
export const KUBECTL_RESOURCE_AUTHORITY = 'loadkubernetescore';
export const KUBECTL_DESCRIBE_AUTHORITY = 'kubernetesdescribe';
export const HELM_RESOURCE_AUTHORITY = 'helmget';

export const OUTPUT_FORMAT_YAML = 'yaml'    // Default
export const OUTPUT_FORMAT_JSON = 'json'

export type K8sResource = {
  apiVersion?: any,
  kind?: any,
  metadata?: any,
  spec?: any,
  status?: any
}

type K8sResourceDescriptor = { resource: K8sResource, time: number, size: number };

export function denounceUri(uri: Uri): string {
  return uri.toString(true).replace(/&_=[0-9]+/g, '');
}

export function findOpenEditorUri(uri: Uri): Uri {
  const denouncedUri = denounceUri(uri);
  return workspace.textDocuments.map((doc) => doc.uri).find((docUri) => denounceUri(docUri) === denouncedUri);
}

export function findOpenEditorDocument(uri: Uri): TextDocument {
  const denouncedUri = denounceUri(uri);
  return workspace.textDocuments.find((doc) => denounceUri(doc.uri) === denouncedUri);
}

/**
 * Get output format from openshiftToolkit.outputFormat
 * default yaml
 *
 * @returns output format
 */
export function getOutputFormat(): string {
  return workspace.getConfiguration('openshiftToolkit').get('outputFormat');
}

export function kubefsUri(namespace: string | null | undefined /* TODO: rationalise null and undefined */,
  value: string, outputFormat: string, action?: string, dedupe?: boolean): Uri {
  const docname = `${value.replace('/', '-')}${outputFormat !== '' ? `.${outputFormat}` : ''}`;
  const nonce = new Date().getTime();
  const nsquery = namespace ? `ns=${namespace}&` : '';
  const scheme = action === 'describe' ? K8S_RESOURCE_SCHEME_READONLY : K8S_RESOURCE_SCHEME;
  const authority = action === 'describe' ? KUBECTL_DESCRIBE_AUTHORITY : KUBECTL_RESOURCE_AUTHORITY;
  const uri = `${scheme}://${authority}/${docname}?${nsquery}value=${value}&_=${nonce}`;
  const newUri = Uri.parse(uri);
  if (!dedupe) {
    return newUri;
  }
  const editedUri = findOpenEditorUri(newUri);
  return editedUri ? editedUri : newUri;
}

export function helmfsUri(releaseName: string, revision: number | undefined, dedupe?: boolean): Uri {
  const revisionSuffix = revision ? `-${revision}` : '';
  const revisionQuery = revision ? `&revision=${revision}` : '';

  const docname = `helmrelease-${releaseName}${revisionSuffix}.txt`;
  const nonce = new Date().getTime();
  const uri = `${K8S_RESOURCE_SCHEME}://${HELM_RESOURCE_AUTHORITY}/${docname}?value=${releaseName}${revisionQuery}&_=${nonce}`;
  const newUri = Uri.parse(uri);
  if (!dedupe) {
    return newUri;
  }
  const editedUri = findOpenEditorUri(newUri);
  return editedUri ? editedUri : newUri;
}

/* Parses the provided content as JSON or YAML (always defaulting to YAML) */
export function getK8sResourceObject(document: string): K8sResource {
  // Try parsing as JSON if outputFormat is set to JSON
  if (OUTPUT_FORMAT_JSON === getOutputFormat()) {
    try { return JSON.parse(document) as K8sResource; } catch { /* ignore */ }
  }

  // If not JSON or not parsed - try parcing as YAML
  try { return parse(document) as K8sResource; } catch { /* ignore */ }

  return {} as K8sResource; // Never return 'undefined'
}

/* A K8s Resource must have at least API Version and Kind */
export function isK8sResource(resource?: K8sResource): boolean {
  if (!resource) return false;
  if (!resource.apiVersion) return false;
  if (!resource.kind) return false;
  return true;
}

function getK8sResourceApiVersion(resource?: K8sResource): string {
  return resource?.apiVersion || '';
}

function getK8sResourceKind(resource?: K8sResource): string {
  return resource?.kind || '';
}

// Field manager used for the local K8s resources on apply operation
const OST_FIELD_MANAGER = 'vscode-openshift-tools';

export class K8sResourceCache {
  private static INSTANCE = new K8sResourceCache();

  static get Instance() {
    return K8sResourceCache.INSTANCE;
  }

  private configs: Map<string, K8sResourceDescriptor> = new Map();

  public get(uri: Uri) {
    return this.configs.get(denounceUri(uri));
  }

  public set(uri: Uri, document: string) {
    const resourceAuthority = uri.authority;
    // Cache the only Kubernetes resources
    if (resourceAuthority === KUBECTL_RESOURCE_AUTHORITY) {
      this.configs.set(denounceUri(uri), {
        resource: getK8sResourceObject(document),
        time: Date.now(),
        size: document ? document.length : 0
      });
    }
  }

  // Time stamp is one of:
  // - Resource metadata.creationTimestamp, if exists,
  // - otherwise, time when the resource was added to the cache, if exists
  // - otherwise, 0 - as no resource was found in cache
  public getCachedResourceCreationTime(cachedResource: K8sResourceDescriptor) {
    if (!cachedResource) return 0;

    // Try getting the creation timestamp from resource metadata
    try {
      return new Date(cachedResource.resource.metadata?.creationTimestamp).getTime();
    } catch {
      // Ignore
    }

    // Use the time when the resource was added to the cache
    return cachedResource.time;
  }

  public getStat(uri: Uri): FileStat {
    const cachedResource = this.get(uri);

    const timestamp = this.getCachedResourceCreationTime(cachedResource);
    const size = cachedResource ? cachedResource.size : 0;
    return {
      type: FileType.File,
      ctime: timestamp,
      mtime: timestamp,
      size
    };
  }

  public isSameResourceDocument(uri: Uri, document: string): Boolean {
    const editorResource: K8sResource = getK8sResourceObject(document); // Editor document
    return this.isSameResource(this.get(uri)?.resource, editorResource);
  }

  public async validateResourceDocument(uri: Uri, document: string): Promise<Diagnostic[]> {
    const resource: K8sResource = await Neater.neatK8sResource(getK8sResourceObject(document)); // Editor document
    if (!isK8sResource(resource)) {
      return [];
    }
    const textDocument = findOpenEditorDocument(uri);
    if (textDocument.languageId !== 'yaml' && textDocument.languageId !== 'json') {
      return [];
    }

    const cachedResource: K8sResource = this.get(uri)?.resource;
    if (!cachedResource) { // Nothing to validate against - skip
      return [];
    }

    const resourceName = cachedResource.metadata.name;
    const namespace = cachedResource.metadata.namespace || 'default';
    const kind = cachedResource.kind.toLowerCase();

    // Here 'textDocument.languageId' can be the only 'yaml' or 'json'
    const yamlOrJsonRoot = textDocument.languageId === 'json' ? parseTree(document) : parseDocument(document, { keepSourceTokens: true });

    const immutableFieldChangeError = ((fieldPath: string[]) =>
      `The field "${fieldPath.join('.')}" cannot be changed after the resource has been created. ` +
      'Kubernetes does not allow updates to immutable fields such as apiVersion, kind, metadata.name, or metadata.namespace.');
    const nullRange = new Range(textDocument.positionAt(0), textDocument.positionAt(0));
    const errors: Diagnostic[] = [];

    // Validate whether the K8s resource is the same (kine/apiVersion/name/namespace)
    if (!this.isSameKind(cachedResource, resource)) {
      const fieldPath = ['kind'];
      const range = getRangeFromPath(textDocument, yamlOrJsonRoot, fieldPath, PART_VALUE) ?? nullRange;
      const message = immutableFieldChangeError(fieldPath);
      errors.push(new Diagnostic(range, message, DiagnosticSeverity.Error));
    }
    if (!this.isSameApiVersion(cachedResource, resource)) {
      const fieldPath = ['apiVersion'];
      const range = getRangeFromPath(textDocument, yamlOrJsonRoot, fieldPath, PART_VALUE) ?? nullRange;
      const message = immutableFieldChangeError(fieldPath);
      errors.push(new Diagnostic(range, message, DiagnosticSeverity.Error));
    }
    if (!this.isSameName(cachedResource, resource)) {
      const fieldPath = ['metadata', 'name'];
      const range = getRangeFromPath(textDocument, yamlOrJsonRoot, fieldPath, PART_VALUE) ?? nullRange;
      const message = immutableFieldChangeError(fieldPath);
      errors.push(new Diagnostic(range, message, DiagnosticSeverity.Error));
    }
    if (!this.isSameNamespace(cachedResource, resource)) {
      const fieldPath = ['metadata', 'namespace'];
      const range = getRangeFromPath(textDocument, yamlOrJsonRoot, fieldPath, PART_VALUE) ?? nullRange;
      const message = immutableFieldChangeError(fieldPath);
      errors.push(new Diagnostic(range, message, DiagnosticSeverity.Error));
    }

    // Validate the Managed fields

    // Get live resource JSON from the cluster
    const options = [];
    options.push(new CommandOption('-o', 'json', false, false));
    options.push(new CommandOption('--show-managed-fields', 'true', false, false));
    if (namespace) {
      options.push(new CommandOption('--namespace', namespace));
    }

    const ced = await CliChannel.getInstance().executeTool(new CommandText('oc', `get ${kind} ${resourceName} `, options), undefined, false);
    if (ced.error) {
      const range = new Range(0, 0, 0, 1);
      const message = 'Failed to retrieve the current version of the Kubernetes resource. ' +
        'Change validation was skipped. Check that the resource is still present and your connection to the cluster is healthy.'
      errors.push(new Diagnostic(range, message, DiagnosticSeverity.Error));
    } else {
      const live = JSON.parse(ced.stdout);
      const getNestedValue = ((obj: any, path: string[]) => path.reduce((acc, key) => acc && acc[key], obj));
      const isFieldModified = (fieldPath: string[], desired: any, live: any): boolean => {
        const desiredVal = getNestedValue(desired, fieldPath);
        const liveVal = getNestedValue(live, fieldPath);
        return !_.isEqual(desiredVal, liveVal);
      };

      const conflicts = new Set<{ path: string[], manager: string }>();
      for (const entry of live.metadata?.managedFields || []) {
        if (entry.manager === OST_FIELD_MANAGER || entry.manager === 'kubectl' || entry.operation !== 'Apply') continue;
        const fieldsV1 = entry.fieldsV1 || {};

        for (const section of ['f:spec', 'f:metadata', 'f:status']) {
          if (fieldsV1[section]) {
            const paths = extractManagedPaths(fieldsV1[section], [section.replace('f:', '')]);
            paths.forEach(p => {
              if (isFieldModified(p, resource, live)) {
                conflicts.add({ path: p, manager: entry.manager });
              }
            });
          }
        }
      }

      // Check if local manifest sets any of those paths
      function hasConflict(obj: any, path: string[]): boolean {
        if (!obj) return false;
        if (path.length === 0) return true;

        const [head, ...tail] = path;
        const selectorMatch = parseMappingValueSegment(head);
        if (selectorMatch) {
          if (!Array.isArray(obj)) return false;

          const match = obj.find(item => {
            for (let i = 0; i < selectorMatch.values.length; i += 2) {
              if (String(item?.[selectorMatch.values[i].name]) !== String(selectorMatch.values[i].value)) {
                return false;
              }
            }
            return true;
          });
          if (!match) return false;
          return hasConflict(match, tail);
        }

        if (typeof obj !== 'object' || !(head in obj)) return false;

        return hasConflict(obj[head], tail);
      }

      const managedFieldChangeError = ((fieldPath: string[], manager: string) =>
        `The field "${fieldPath.join('.')}" cannot be modified because it is currently managed by another tool ("${manager}").`);

      for (const c of conflicts) {
        if (c?.path && c?.manager && c.path.length > 0) {
          if (hasConflict(resource, c.path)) {
              const range = getRangeFromPath(textDocument, yamlOrJsonRoot, c.path, PART_KEY) ?? nullRange;
              const message = managedFieldChangeError(c.path, c.manager);
              const diagnostic = new Diagnostic(range, message, DiagnosticSeverity.Error);
              diagnostic.source = OST_FIELD_MANAGER;
              errors.push(diagnostic);
          }
        }
      }
    }
    return errors;
  }

  private isSameResource(cachedResource: K8sResource, resource: K8sResource): Boolean {
    if (!resource || !cachedResource) {
      return false;
    }

    return this.isSameKind(cachedResource, resource)
      && this.isSameApiVersion(cachedResource, resource)
      && this.isSameName(cachedResource, resource)
      && this.isSameNamespace(cachedResource, resource)
  }

  private isSameApiVersion(cachedResource: K8sResource, resource: K8sResource): Boolean {
    if (!resource || !cachedResource) {
      return false;
    }

    if (cachedResource.apiVersion === undefined && resource.apiVersion === undefined) {
      return false;
    }

    return cachedResource.apiVersion === resource.apiVersion;
  }

  private isSameName(cachedResource: K8sResource, resource: K8sResource): Boolean {
    if (!resource || !cachedResource) {
      return false;
    }

    if (cachedResource.metadata?.name === undefined && resource.metadata?.name === undefined) {
      return false;
    }

    return cachedResource.metadata?.name === resource.metadata?.name;
  }

  private isSameNamespace(cachedResource: K8sResource, resource: K8sResource): Boolean {
    if (!resource || !cachedResource) {
      return false;
    }

    if (cachedResource.metadata?.namespace === undefined && resource.metadata?.namespace === undefined) {
      return false;
    }

    return cachedResource.metadata?.namespace === resource.metadata?.namespace;
  }

  private isSameKind(cachedResource: K8sResource, resource: K8sResource): Boolean {
    if (!resource || !cachedResource) {
      return false;
    }

    if (cachedResource.kind === undefined && resource.kind === undefined) {
      return false;
    }

    return cachedResource.kind === resource.kind;
  }
}

// Known problematic fields (not always marked readOnly in schema)
const knownServerManagedFields = [
  'metadata.managedFields',
  'metadata.creationTimestamp',
  'metadata.resourceVersion',
  'metadata.selfLink',
  'metadata.uid',
  'metadata.generation',
  'status',
  'metadata.annotations."kubectl.kubernetes.io/last-applied-configuration"',
];

export class Neater {

  public static safeLoadYaml(raw: string): string | undefined {
    try {
      return parse(raw);
    } catch {
      // Ignore
    }
  }

  private static parsePath(path: string): string[] {
    return path.includes('"')
      ? path.match(/(?:[^."]+|"[^"]*")+/g)!.map(p => p.replace(/^"|"$/g, ''))
      : path.split('.');
  }

  private static removePaths(obj: any, paths: string[]) {
    for (const path of paths) {
      const parsedPath = Neater.parsePath(path);
      _.unset(obj, parsedPath);
    }
  }

  private static getK8sResourceType(resource: K8sResource) {
    const apiVersion = getK8sResourceApiVersion(resource).replaceAll('/', '.');
    const kind = getK8sResourceKind(resource);
    return `io.k8s.api.${apiVersion}.${kind}`;
  }

  public static async neatK8sResource(resource: K8sResource, executionContext?: ExecutionContext): Promise<K8sResource> {
    if (isK8sResource(resource)) {
      // Load and dereference K8s Open API schema
      const openapi = JSON.parse(await Oc.getK8sOpenAPI(executionContext));
      const dereferenced = await $RefParser.dereference(openapi);

      const typeName = this.getK8sResourceType(resource);
      const deploymentSchema = dereferenced.definitions[typeName];

      const fieldsToRemove = [];

      // Traverse schema and collect all readOnly fields
      function collectReadOnlyPaths(schema: any, path: string[] = []): void {
        if (!schema || typeof schema !== 'object') {
          return;
        }

        if (schema.readOnly) {
          fieldsToRemove.push(path.join('.'));
        }

        if (schema.type === 'array' && schema.items) {
          collectReadOnlyPaths(schema.items, [...path, '[*]']);
        }

        if (schema.properties) {
          for (const [key, value] of Object.entries(schema.properties)) {
            collectReadOnlyPaths(value, [...path, key]);
          }
        }
      }
      collectReadOnlyPaths(deploymentSchema);
      Neater.removePaths(resource, Array.from(new Set([...fieldsToRemove, ...knownServerManagedFields])));
    }
    return resource;
  }

  /**
   * Neat the provided raw YANL schema by removing the read-only and default values,
   * thus clearing it and making it ready for 'kubectl apply'.
   *
   * @param raw string
   * @param executionContext
   */
  public static async neat(raw: string, executionContext?: ExecutionContext): Promise<string> {
    const resource = getK8sResourceObject(raw);
    return isK8sResource(resource) ? stringify(await Neater.neatK8sResource(resource, executionContext), YAML_STRINGIFY_OPTIONS) : raw;
  }
}

function extractManagedPaths(fields: any, prefix: string[] = []): string[][] {
  const paths: string[][] = [];

  if (!fields) return paths;

  const generateContainerName = ((prefix: string, fields: any) => {
    const args: string[] = [];
    for (const key in fields) {
      if (key) {
        args.push(`${key}="${fields[key]}"`);
      }
    }
    return `${prefix}[${args.join(',')}]`;
  });

  for (const key in fields) {
    if (key) {
      const value = fields[key];
      let nextPathSegment: string | null = null;

      // Handle the f: prefix (fields)
      if (key.startsWith('f:')) {
        nextPathSegment = key.substring(2);  // Remove f: prefix
      }
      // Handle the k: prefix (keys with specific values)
      else if (key.startsWith('k:')) {
        try {
          const parsed = JSON.parse(key.substring(2)); // Remove k: and parse the JSON
          if (parsed) {
            nextPathSegment = generateContainerName(prefix.at(-1), parsed);  // Handle containers[name=runtime]
          } else {
            nextPathSegment = key;  // Fallback if no name is found
          }
        } catch (e) {
          nextPathSegment = key;  // Fallback for invalid JSON
        }
      }

      const newPath = nextPathSegment ? [...prefix, nextPathSegment] : prefix;
      const isEmpty = (obj: unknown): obj is Record<never, never> =>
        typeof obj === 'object' && obj !== null && Object.keys(obj).length === 0;
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          paths.push(...extractManagedPaths(item, [...newPath, `${key}[${index}]`]));
        });
      } else if (value !== null && typeof value === 'object' && !isEmpty(value)) {
        paths.push(...extractManagedPaths(value, newPath));
      } else {
        paths.push(newPath);
      }
    }
  }
  return paths;
}

const PART_VALUE = 'value';
const PART_KEY = 'key';

/**
 * Helper for YAML
 */

function parseMappingValueSegment(input: string): { key: string, values: { name: string, value: string }[] } | null {
  // Match something like: key[filterKey="value",otherKey="val"]
  const bracketMatch = input.match(/^(\w+)\[(.+)\]$/);
  if (!bracketMatch) return null;

  const [, baseKey, filterString] = bracketMatch;
  const segments = { key: baseKey, values: [] };

  // Match key="value" pairs
  const filterRegex = /(\w+)="(.*?)"/g;
  let match;
  let foundAny = false;

  while ((match = filterRegex.exec(filterString)) !== null) {
    if (match[1] && match[2]) {
      foundAny = true;
      segments.values.push({ name: match[1], value: match[2] });
    }
  }

  // If no valid key="value" found, reject it
  if (!foundAny) return null;

  return segments;
}

function getYamlRange(document: TextDocument, doc: Document.Parsed, path: string[], which: 'key' | 'value'): Range {
  let node: ParsedNode | Pair = doc.contents;
  let parentNode: ParsedNode | Pair = node;
  let matchedItem = null;

  for (const segment of path) {
    if (!node) return null;

    parentNode = node;
    matchedItem = null;

    const filterMatch = parseMappingValueSegment(segment);
    if (filterMatch) {
      const seqNode = isPair(node) ? node.value : node;
      if (!isSeq(seqNode)) return null;

      matchedItem = seqNode.items.find(item => {
        if (!isMap(item)) return false;

        for (let i = 0; i < filterMatch.values.length; i++) {
          const val = item.get(filterMatch.values[i].name, true);
          if (String((val as any)?.value) !== String(filterMatch.values[i].value)) {
            return false;
          }
        }
        return true;
      });

      if (!matchedItem) {
        return null;
      }

      node = matchedItem;
      continue;
    }

    const indexMatch = segment.match(/^(\w+)\[(\d+)\]$/);
    if (indexMatch) {
      const [, , indexStr] = indexMatch;
      const index = parseInt(indexStr, 10);

      const seqNode = isPair(node) ? node.value : node;

      if (!isSeq(seqNode)) return null;
      matchedItem = seqNode.items[index];

      node = matchedItem;
      continue;
    }

    if (isMap(node) || isPair(node)) {
      parentNode = node;

      const pairValue = isPair(node) ? node.value : node;
      if (isMap(pairValue)) {
        node = pairValue.items.find(pair => isScalar(pair.key) && pair.key.value === segment);
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  if (which === PART_KEY) {
    const keyNode = matchedItem ? parentNode : node;
    if (isPair(keyNode)) {
      const mapNode = (keyNode as Pair).key as ParsedNode;
      return mapNode.range ? new Range(document.positionAt(mapNode.range[0]), document.positionAt(mapNode.range[1])) : null;
    }
    return keyNode?.range ? new Range(document.positionAt(keyNode.range[0]), document.positionAt(keyNode.range[1])) : null;
  }

  const valueNode = matchedItem && parentNode !== node ? matchedItem : node;
  if (isScalar(valueNode)) {
    return valueNode.range ? new Range(document.positionAt(valueNode.range[0]), document.positionAt(valueNode.range[1])) : null;
  } else if (isPair(valueNode)) {
    const mapNode = (valueNode as Pair).value as ParsedNode;
    return mapNode.range ? new Range(document.positionAt(mapNode.range[0]), document.positionAt(mapNode.range[1])) : null;
  }
  return valueNode.range ? new Range(document.positionAt(valueNode.range[0]), document.positionAt(valueNode.range[1])) : null;
}

function getJsonRange(document: TextDocument, root: any, path: string[], which: 'key' | 'value'): Range | null {
  let node: Node | undefined = root;
  let parentNode: Node = node;
  let matchedItem = null;

  for (const segment of path) {
    parentNode = node;
    matchedItem = null;

    const filterMatch = parseMappingValueSegment(segment);
    if (filterMatch) {
      const arrayNode = node;
      if (!arrayNode || arrayNode.type !== 'array' || !arrayNode.children) return null;

      matchedItem = arrayNode.children.find(item => {
        if (item.type !== 'object' || !item.children) return false;

        for (let i = 0; i < filterMatch.values.length; i++) {
          const prop = item.children.find(p => {
            if (p.type !== 'property') return false;
            const propertyKey = getNodeValue(p.children?.[0]);
            const propertyValue = getNodeValue(p.children?.[1]);
            return (propertyKey === filterMatch.values[i].name &&
              String(propertyValue) === String(filterMatch.values[i].value));
          });
          if (!prop) {
            return null;
          }
        }
        return item;
      });

      if (!matchedItem) return null;
      node = matchedItem;
    } else if (segment.startsWith('[') && segment.endsWith(']')) {
      const innerKey = segment.slice(1, -1);
      node = findNodeAtLocation(node, [innerKey]);
    } else {
      parentNode = node;

      node = findNodeAtLocation(node, [segment]);
    }

    if (!node) return null;
  }

  const matchingNode = which === PART_KEY && matchedItem ? parentNode : node;
  if (matchingNode.parent?.type === 'property' && matchingNode.parent.children?.length === 2) {
    const [keyNode, valueNode] = matchingNode.parent.children;
    return which === PART_KEY ?
      new Range(document.positionAt(keyNode.offset), document.positionAt(keyNode.offset + keyNode.length)) :
      new Range(document.positionAt(valueNode.offset), document.positionAt(valueNode.offset + valueNode.length));
  }

  if (matchingNode.type === 'property' && matchingNode.children?.length === 2) {
    const [keyNode, valueNode] = matchingNode.children;
    return which === PART_KEY ?
      new Range(document.positionAt(keyNode.offset), document.positionAt(keyNode.offset + keyNode.length)) :
      new Range(document.positionAt(valueNode.offset), document.positionAt(valueNode.offset + valueNode.length));
  }

  return new Range(document.positionAt(matchingNode.offset), document.positionAt(matchingNode.offset + matchingNode.length))
}

function getRangeFromPath(document: TextDocument, yamlOrJsonRoot: any, path: string[], part: 'key' | 'value'): Range | null {
  return document.languageId === 'json' ?
    getJsonRange(document, yamlOrJsonRoot, path, part) :
    getYamlRange(document, yamlOrJsonRoot, path, part);
}