/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftObject, ContextType } from "../../src/odo";
import { Uri } from "vscode";

export class TestItem implements OpenShiftObject {

    constructor(
        private parent: OpenShiftObject,
        private name: string,
        public readonly contextValue: ContextType,
        private children = [],
        public deployed = false,
        public contextPath = Uri.parse('file:///c%3A/Temp')) {
    }

    getName(): string {
        return this.name;
    }

    getTreeItem() {
        return null;
    }

    getChildren() {
        return this.children;
    }

    getParent(): OpenShiftObject {
        return this.parent;
    }

    get label(): string {
        return this.name;
    }
}