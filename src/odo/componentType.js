"use strict";
/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
exports.__esModule = true;
exports.ComponentTypeAdapter = exports.isRegistry = exports.isDevfileComponent = exports.ascDevfileFirst = void 0;
function ascDevfileFirst(c1, c2) {
    return c1.label.localeCompare(c2.label);
}
exports.ascDevfileFirst = ascDevfileFirst;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isDevfileComponent(comp) {
    return comp.Registry;
}
exports.isDevfileComponent = isDevfileComponent;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isRegistry(registry) {
    return registry.Name && registry.URL && registry.Secure !== undefined;
}
exports.isRegistry = isRegistry;
var ComponentTypeAdapter = /** @class */ (function () {
    function ComponentTypeAdapter(name, version, description, tags, registryName) {
        this.name = name;
        this.version = version;
        this.description = description;
        this.tags = tags;
        this.registryName = registryName;
    }
    Object.defineProperty(ComponentTypeAdapter.prototype, "label", {
        get: function () {
            var versionSuffix = this.version ? "/".concat(this.version) : "/".concat(this.registryName);
            return "".concat(this.name).concat(versionSuffix);
        },
        enumerable: false,
        configurable: true
    });
    return ComponentTypeAdapter;
}());
exports.ComponentTypeAdapter = ComponentTypeAdapter;
