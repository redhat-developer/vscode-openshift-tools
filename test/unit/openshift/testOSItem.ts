/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Uri } from "vscode";
import { OpenShiftObject, ContextType } from "../../../src/odo";

export class TestItem implements OpenShiftObject {
    public treeItem = null;

    // eslint-disable-next-line no-useless-constructor
    constructor(
        private parent: OpenShiftObject,
        private name: string,
        public contextValue: ContextType,
        private children = [],
        public deployed = false,
        public contextPath = Uri.parse('file:///c%3A/Temp')) {
    }

    getName(): string {
        return this.name;
    }

    getTreeItem(): null {
        return this.treeItem;
    }

    getChildren(): any[] {
        return this.children;
    }

    getParent(): OpenShiftObject {
        return this.parent;
    }

    get label(): string {
        return this.name;
    }

    public path: string;
}
