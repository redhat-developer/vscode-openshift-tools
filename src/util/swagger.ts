/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { JSONSchema7 } from 'json-schema';
import { Platform } from './platform';
import * as path from 'path';

const _ = require('lodash');
const https = require('https');
const fetch = require('make-fetch-happen').defaults({
    cachePath : path.join(Platform.getUserHomePath(), '.vs-openshift','cache'),
});

export type SwaggerDefinition = {
    definitions?: SwaggerDefinitions;
    description?: string;
    type?: string;
    enum?: string[];
    $ref?: string;
    items?: SwaggerDefinition;
    required?: string[];
    properties?: {
      [prop: string]: SwaggerDefinition;
    };
};

export type SwaggerDefinitions = {
    [name: string]: SwaggerDefinition;
};

export function getDefinitionKey (ocrdKind: string, ocrdVersion: string, definitions: SwaggerDefinitions): string {
    return _.findKey(definitions, (def: SwaggerDefinition) =>
      _.some(def['x-kubernetes-group-version-kind'], ({ group, version, kind }) =>
            ocrdVersion === version && ocrdKind === kind && group
      )
    );
  };

export function getOpenAPISchemaFor(clusterUrl: string, token: string, kind: string, version: string): Promise<JSONSchema7> {
    return fetch(`${clusterUrl}/openapi/v2`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            agent: new https.Agent({
                rejectUnauthorized: false,
            })
        }).then(res => {
            return res.json();
        }).then(swagger => {
            const key = getDefinitionKey(kind, version, swagger.definitions);
            const result = swagger.definitions[key];
            delete swagger.definitions[key]; // delete requested schema from definition to avoid cycles
            result.definitions = swagger.definitions; // required to resolve oopenapischema references
            return result;
        });
}