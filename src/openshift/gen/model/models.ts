import localVarRequest from 'request';

export * from './comGithubOpenshiftApiProjectV1Project';
export * from './comGithubOpenshiftApiProjectV1ProjectList';
export * from './comGithubOpenshiftApiProjectV1ProjectRequest';
export * from './comGithubOpenshiftApiProjectV1ProjectSpec';
export * from './comGithubOpenshiftApiProjectV1ProjectStatus';
export * from './v1APIGroup';
export * from './v1APIResource';
export * from './v1APIResourceList';
export * from './v1DeleteOptions';
export * from './v1GroupVersionForDiscovery';
export * from './v1ListMeta';
export * from './v1ManagedFieldsEntry';
export * from './v1NamespaceCondition';
export * from './v1ObjectMeta';
export * from './v1OwnerReference';
export * from './v1Preconditions';
export * from './v1ServerAddressByClientCIDR';
export * from './v1Status';
export * from './v1StatusCause';
export * from './v1StatusDetails';
export * from './v1WatchEvent';

import * as fs from 'fs';

export interface RequestDetailedFile {
    value: Buffer;
    options?: {
        filename?: string;
        contentType?: string;
    }
}

export type RequestFile = string | Buffer | fs.ReadStream | RequestDetailedFile;


import { ComGithubOpenshiftApiProjectV1Project } from './comGithubOpenshiftApiProjectV1Project';
import { ComGithubOpenshiftApiProjectV1ProjectList } from './comGithubOpenshiftApiProjectV1ProjectList';
import { ComGithubOpenshiftApiProjectV1ProjectRequest } from './comGithubOpenshiftApiProjectV1ProjectRequest';
import { ComGithubOpenshiftApiProjectV1ProjectSpec } from './comGithubOpenshiftApiProjectV1ProjectSpec';
import { ComGithubOpenshiftApiProjectV1ProjectStatus } from './comGithubOpenshiftApiProjectV1ProjectStatus';
import { V1APIGroup } from './v1APIGroup';
import { V1APIResource } from './v1APIResource';
import { V1APIResourceList } from './v1APIResourceList';
import { V1DeleteOptions } from './v1DeleteOptions';
import { V1GroupVersionForDiscovery } from './v1GroupVersionForDiscovery';
import { V1ListMeta } from './v1ListMeta';
import { V1ManagedFieldsEntry } from './v1ManagedFieldsEntry';
import { V1NamespaceCondition } from './v1NamespaceCondition';
import { V1ObjectMeta } from './v1ObjectMeta';
import { V1OwnerReference } from './v1OwnerReference';
import { V1Preconditions } from './v1Preconditions';
import { V1ServerAddressByClientCIDR } from './v1ServerAddressByClientCIDR';
import { V1Status } from './v1Status';
import { V1StatusCause } from './v1StatusCause';
import { V1StatusDetails } from './v1StatusDetails';
import { V1WatchEvent } from './v1WatchEvent';

/* tslint:disable:no-unused-variable */
let primitives = [
                    "string",
                    "boolean",
                    "double",
                    "integer",
                    "long",
                    "float",
                    "number",
                    "any"
                 ];

let enumsMap: {[index: string]: any} = {
}

let typeMap: {[index: string]: any} = {
    "ComGithubOpenshiftApiProjectV1Project": ComGithubOpenshiftApiProjectV1Project,
    "ComGithubOpenshiftApiProjectV1ProjectList": ComGithubOpenshiftApiProjectV1ProjectList,
    "ComGithubOpenshiftApiProjectV1ProjectRequest": ComGithubOpenshiftApiProjectV1ProjectRequest,
    "ComGithubOpenshiftApiProjectV1ProjectSpec": ComGithubOpenshiftApiProjectV1ProjectSpec,
    "ComGithubOpenshiftApiProjectV1ProjectStatus": ComGithubOpenshiftApiProjectV1ProjectStatus,
    "V1APIGroup": V1APIGroup,
    "V1APIResource": V1APIResource,
    "V1APIResourceList": V1APIResourceList,
    "V1DeleteOptions": V1DeleteOptions,
    "V1GroupVersionForDiscovery": V1GroupVersionForDiscovery,
    "V1ListMeta": V1ListMeta,
    "V1ManagedFieldsEntry": V1ManagedFieldsEntry,
    "V1NamespaceCondition": V1NamespaceCondition,
    "V1ObjectMeta": V1ObjectMeta,
    "V1OwnerReference": V1OwnerReference,
    "V1Preconditions": V1Preconditions,
    "V1ServerAddressByClientCIDR": V1ServerAddressByClientCIDR,
    "V1Status": V1Status,
    "V1StatusCause": V1StatusCause,
    "V1StatusDetails": V1StatusDetails,
    "V1WatchEvent": V1WatchEvent,
}

export class ObjectSerializer {
    public static findCorrectType(data: any, expectedType: string) {
        if (data == undefined) {
            return expectedType;
        } else if (primitives.indexOf(expectedType.toLowerCase()) !== -1) {
            return expectedType;
        } else if (expectedType === "Date") {
            return expectedType;
        } else {
            if (enumsMap[expectedType]) {
                return expectedType;
            }

            if (!typeMap[expectedType]) {
                return expectedType; // w/e we don't know the type
            }

            // Check the discriminator
            let discriminatorProperty = typeMap[expectedType].discriminator;
            if (discriminatorProperty == null) {
                return expectedType; // the type does not have a discriminator. use it.
            } else {
                if (data[discriminatorProperty]) {
                    var discriminatorType = data[discriminatorProperty];
                    if(typeMap[discriminatorType]){
                        return discriminatorType; // use the type given in the discriminator
                    } else {
                        return expectedType; // discriminator did not map to a type
                    }
                } else {
                    return expectedType; // discriminator was not present (or an empty string)
                }
            }
        }
    }

    public static serialize(data: any, type: string) {
        if (data == undefined) {
            return data;
        } else if (primitives.indexOf(type.toLowerCase()) !== -1) {
            return data;
        } else if (type.lastIndexOf("Array<", 0) === 0) { // string.startsWith pre es6
            let subType: string = type.replace("Array<", ""); // Array<Type> => Type>
            subType = subType.substring(0, subType.length - 1); // Type> => Type
            let transformedData: any[] = [];
            for (let index = 0; index < data.length; index++) {
                let datum = data[index];
                transformedData.push(ObjectSerializer.serialize(datum, subType));
            }
            return transformedData;
        } else if (type === "Date") {
            return data.toISOString();
        } else {
            if (enumsMap[type]) {
                return data;
            }
            if (!typeMap[type]) { // in case we dont know the type
                return data;
            }

            // Get the actual type of this object
            type = this.findCorrectType(data, type);

            // get the map for the correct type.
            let attributeTypes = typeMap[type].getAttributeTypeMap();
            let instance: {[index: string]: any} = {};
            for (let index = 0; index < attributeTypes.length; index++) {
                let attributeType = attributeTypes[index];
                instance[attributeType.baseName] = ObjectSerializer.serialize(data[attributeType.name], attributeType.type);
            }
            return instance;
        }
    }

    public static deserialize(data: any, type: string) {
        // polymorphism may change the actual type.
        type = ObjectSerializer.findCorrectType(data, type);
        if (data == undefined) {
            return data;
        } else if (primitives.indexOf(type.toLowerCase()) !== -1) {
            return data;
        } else if (type.lastIndexOf("Array<", 0) === 0) { // string.startsWith pre es6
            let subType: string = type.replace("Array<", ""); // Array<Type> => Type>
            subType = subType.substring(0, subType.length - 1); // Type> => Type
            let transformedData: any[] = [];
            for (let index = 0; index < data.length; index++) {
                let datum = data[index];
                transformedData.push(ObjectSerializer.deserialize(datum, subType));
            }
            return transformedData;
        } else if (type === "Date") {
            return new Date(data);
        } else {
            if (enumsMap[type]) {// is Enum
                return data;
            }

            if (!typeMap[type]) { // dont know the type
                return data;
            }
            let instance = new typeMap[type]();
            let attributeTypes = typeMap[type].getAttributeTypeMap();
            for (let index = 0; index < attributeTypes.length; index++) {
                let attributeType = attributeTypes[index];
                instance[attributeType.name] = ObjectSerializer.deserialize(data[attributeType.baseName], attributeType.type);
            }
            return instance;
        }
    }
}

export interface Authentication {
    /**
    * Apply authentication settings to header and query params.
    */
    applyToRequest(requestOptions: localVarRequest.Options): Promise<void> | void;
}

export class HttpBasicAuth implements Authentication {
    public username: string = '';
    public password: string = '';

    applyToRequest(requestOptions: localVarRequest.Options): void {
        requestOptions.auth = {
            username: this.username, password: this.password
        }
    }
}

export class HttpBearerAuth implements Authentication {
    public accessToken: string | (() => string) = '';

    applyToRequest(requestOptions: localVarRequest.Options): void {
        if (requestOptions && requestOptions.headers) {
            const accessToken = typeof this.accessToken === 'function'
                            ? this.accessToken()
                            : this.accessToken;
            requestOptions.headers["Authorization"] = "Bearer " + accessToken;
        }
    }
}

export class ApiKeyAuth implements Authentication {
    public apiKey: string = '';

    constructor(private location: string, private paramName: string) {
    }

    applyToRequest(requestOptions: localVarRequest.Options): void {
        if (this.location == "query") {
            (<any>requestOptions.qs)[this.paramName] = this.apiKey;
        } else if (this.location == "header" && requestOptions && requestOptions.headers) {
            requestOptions.headers[this.paramName] = this.apiKey;
        } else if (this.location == 'cookie' && requestOptions && requestOptions.headers) {
            if (requestOptions.headers['Cookie']) {
                requestOptions.headers['Cookie'] += '; ' + this.paramName + '=' + encodeURIComponent(this.apiKey);
            }
            else {
                requestOptions.headers['Cookie'] = this.paramName + '=' + encodeURIComponent(this.apiKey);
            }
        }
    }
}

export class OAuth implements Authentication {
    public accessToken: string = '';

    applyToRequest(requestOptions: localVarRequest.Options): void {
        if (requestOptions && requestOptions.headers) {
            requestOptions.headers["Authorization"] = "Bearer " + this.accessToken;
        }
    }
}

export class VoidAuth implements Authentication {
    public username: string = '';
    public password: string = '';

    applyToRequest(_: localVarRequest.Options): void {
        // Do nothing
    }
}

export type Interceptor = (requestOptions: localVarRequest.Options) => (Promise<void> | void);
