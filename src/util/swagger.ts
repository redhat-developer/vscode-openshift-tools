/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { JSONSchema7 } from 'json-schema';

const request = require('request');
const _ = require('lodash');

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
    return new Promise((resolve, reject) => {
        request(`${clusterUrl}/openapi/v2`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                rejectUnauthorized: false,
            },
            (err, response, body) =>{
                if (err) {
                    reject(err);
                } else {
                    try {
                        const swagger = JSON.parse(body);
                        const key = getDefinitionKey(kind, version, swagger.definitions);
                        const result = swagger.definitions[key];
                        delete swagger.definitions[key];
                        result.definitions = swagger.definitions;
                        resolve(result);
                    } catch (parsingError) {
                        reject(parsingError);
                    }
                }
            }
        )
    });
}