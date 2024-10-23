/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import parse from 'json-to-ast';
import * as vscode from 'vscode';
import { MappingItem, Node, NodeProvider } from './locator-util';

export interface ASTPosition {
    readonly line: number;
    readonly column: number;
    readonly offset: number;
}

export interface ASTLocation {
    readonly start: ASTPosition;
    readonly end: ASTPosition;
    readonly source?;
}

export interface AST {
    readonly type: string;
    readonly loc: ASTLocation;
}

export interface ASTObject extends AST {
    readonly children: AST[];
}

export interface ASTProperty extends AST {
    readonly key: AST;
    readonly value: AST;
}

export interface ASTIdentifier extends AST {
    readonly raw: string;
    readonly value: string;
}

export interface ASTLiteral extends AST {
    readonly raw: string;
    readonly value: string;
}

export interface ASTArray extends AST {
    readonly children: AST[];
}

export class JsonNode implements Node{
    readonly ast: AST;
    protected jsonDocument: JsonDocument;

    readonly type: string;
    readonly raw?: string;
    readonly startPosition: number;
    readonly endPosition: number;
    readonly parent?: JsonNode;

    constructor (jsonDocument: JsonDocument, ast: AST, parent?: JsonNode) {
        this.jsonDocument = jsonDocument;
        this.ast = ast;
        this.type = ast.type;
        this.startPosition = ast.loc.start.offset;
        this.endPosition = ast.loc.end.offset;

        if (parent) {
            this.parent = parent;
        }
    }
}

export class JsonObject extends JsonNode {
    readonly children: JsonNode[];

    constructor (jsonDocument: JsonDocument, ast: ASTObject, parent?: JsonNode) {
        super(jsonDocument, ast, parent);
        this.children = ast.children.map((c) => jsonDocument.createJsonNode(c, this));
    }
}

export class JsonArray extends JsonNode {
    readonly items: JsonNode[];

    constructor (jsonDocument: JsonDocument, ast: ASTArray, parent?: JsonNode) {
        super(jsonDocument, ast, parent);
        this.items = ast.children.map((c) => jsonDocument.createJsonNode(c, this));
    }
}

export class JsonProperty extends JsonNode implements MappingItem {
    readonly key: JsonNode;
    readonly value: JsonNode;

    constructor (jsonDocument: JsonDocument, ast: ASTProperty, parent?: JsonNode) {
        super(jsonDocument, ast, parent);
        this.key = this.jsonDocument.createJsonNode(ast.key, this);
        this.value = this.jsonDocument.createJsonNode(ast.value, this);
    }
}

export class JsonIdentifier extends JsonNode {
    readonly raw: string;
    readonly value: string;

    constructor (jsonDocument: JsonDocument, ast: ASTIdentifier, parent?: JsonNode) {
        super(jsonDocument, ast, parent);
        this.raw = ast.value; // We need the only value text without surrounding double quotes
        this.value = ast.raw; // We need whole value including surrounding double quotes
    }
}

export class JsonLiteral extends JsonNode {
    readonly raw: string;
    readonly value: string;

    constructor (jsonDocument: JsonDocument, ast: ASTLiteral, parent?: JsonNode) {
        super(jsonDocument, ast, parent);
        this.raw = ast.value; // We need the only value text without surrounding double quotes
        this.value = ast.raw; // We need whole value including surrounding double quotes
    }
}

export function type(node: any): string | undefined {
    if ('type' in node) {
        return node.type;
    }
    return undefined;
}

export function isObject(node: any): node is JsonObject | ASTObject {
    return type(node) === 'Object';
}

export function isProperty(node: any): node is JsonProperty | ASTProperty {
    return type(node) === 'Property';
}

export function isIdentifier(node: any): node is JsonIdentifier | ASTIdentifier {
    return type(node) === 'Identifier';
}

export function isLiteral(node: any): node is JsonIdentifier | ASTLiteral {
    return type(node) === 'Literal';
}

export function isArray(node: any): node is JsonArray | ASTArray {
    return type(node) === 'Array';
}

class JsonDocument implements NodeProvider{
    readonly nodes: JsonNode[];
    readonly errors: string[];

    constructor (astNodes: AST[], errors: string[]) {
        this.nodes = astNodes.map((c) => this.createJsonNode(c));
        this.errors = errors;
    }

    public createJsonNode(ast: AST, parent?: JsonNode): JsonNode {
        if (isObject(ast)) {
            return new JsonObject(this, ast, parent);
        } else if (isProperty(ast)) {
            return new JsonProperty(this, ast, parent);
        } else if (isIdentifier(ast)) {
            return new JsonIdentifier(this, ast, parent);
        } else if (isLiteral(ast)) {
            return new JsonLiteral(this, ast, parent);
        } else if (isArray(ast)) {
            return new JsonArray(this, ast, parent);
        }
        return new JsonNode(this, ast, parent);
    }
}

export interface JsonCachedDocuments {
    // the documents represents the yaml text
    jsonDocs: JsonDocument[];

    // the version of the document to avoid duplicate work on the same text
    version: number;
}

/**
 * A json interpreter parse the json text and find the matched ast node from vscode location.
 */
export class JsonLocator {
    // a mapping of URIs to cached documents
    private cache: { [key: string]: JsonCachedDocuments }  = {};

    // /**
    //  * Parse the json text and find the best node&document for the given position.
    //  *
    //  * @param textDocument vscode text document
    //  * @param pos vscode position
    //  * @returns the search results of json elements at the given position
    //  */
    // public getMatchedElement(textDocument: vscode.TextDocument, pos: vscode.Position): JsonMatchedElement | undefined {
    //     const key: string = textDocument.uri.toString();
    //     this.ensureCache(key, textDocument);
    //     const cacheEntry = this.cache[key];
    //     if (!cacheEntry) {
    //         return undefined;
    //     }
    //     // findNodeAtPosition will find the matched node at given position
    //     return findNodeAtPosition(cacheEntry.jsonDocs, cacheEntry.lineLengths, pos.line, pos.character);
    // }

    /**
     * Parse the json text and find the best node&document for the given position.
     *
     * @param textDocument vscode text document
     * @returns the search results of json elements at the given position
     */
    public getJsonDocuments(textDocument: vscode.TextDocument): JsonDocument[] {
        const key: string = textDocument.uri.toString();
        this.ensureCache(key, textDocument);
        if (!this.cache[key]) {
            return [];
        }
        return this.cache[key].jsonDocs ? this.cache[key].jsonDocs : [];
    }

    private ensureCache(key: string, textDocument: vscode.TextDocument): void {
        if (!this.cache[key]) {
            this.cache[key] = <JsonCachedDocuments> { version: -1 };
        }

        if (this.cache[key].version !== textDocument.version) {
            // the document from parse method is cached into JsonCachedDocuments to avoid duplicate
            // parse against the same text.
            try {
                JSON.parse(textDocument.getText()); // this is used to detect errors in the json file before actually parse it with the json-asty lib
                const ast = parse(textDocument.getText(), {loc: true});
                this.cache[key].jsonDocs = [new JsonDocument([ast], [])];
                this.cache[key].version = textDocument.version;
            } catch {
                delete this.cache[key];
            }
        }
    }
}

// a global instance of json locator
const jsonLocator = new JsonLocator();

export { jsonLocator };
