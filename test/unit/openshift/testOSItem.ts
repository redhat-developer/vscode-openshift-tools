/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Uri } from 'vscode';
import { OpenShiftObject, ContextType } from '../../../src/odo';
import { SourceType } from '../../../src/odo/config';
import { BuilderImage } from '../../../src/odo/builderImage';
import { ComponentKind } from '../../../src/odo/componentType';

export class TestItem implements OpenShiftObject {
    public treeItem = null;
    public active = true;
    // eslint-disable-next-line no-useless-constructor
    constructor(
        private parent: OpenShiftObject,
        private name: string,
        public contextValue: ContextType,
        private children = [],
        public contextPath = Uri.parse('file:///c%3A/Temp'),
        public path?: string,
        public compType: string = SourceType.LOCAL,
        public kind: ComponentKind = ComponentKind.S2I) {
    }

    builderImage?: BuilderImage;
    iconPath?: Uri;
    description?: string;
    detail?: string;
    picked?: boolean;
    alwaysShow?: boolean;

    getName(): string {
        return this.name;
    }

    getTreeItem(): null {
        return this.treeItem;
    }

    getChildren(): any[] {
        return this.children;
    }

    removeChild(item: OpenShiftObject): Promise<void> {
        return;
    }

    addChild(item: OpenShiftObject): Promise<OpenShiftObject> {
        return Promise.resolve(item);
    }

    getParent(): OpenShiftObject {
        return this.parent;
    }

    get label(): string {
        return this.name;
    }
}
