import { OpenShiftObject } from "../../src/odo";

export class TestItem implements OpenShiftObject {
    constructor(
        private parent: OpenShiftObject,
        private name) {
    }

    getName(): string {
        return this.name;
    }

    getTreeItem() {
        return null;
    }

    getChildren() {
        return [];
    }

    getParent(): OpenShiftObject {
        return this.parent;
    }

    get label(): string {
        return this.name;
    }
}