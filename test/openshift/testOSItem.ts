/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftObject } from "../../src/odo";
import { ContextType } from '../../src/util/constants';

export class TestItem implements OpenShiftObject {
    public readonly contextValue: ContextType;
    constructor(
        private parent: OpenShiftObject,
        private name: string,
        private children = [],
        public deployed = false) {
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