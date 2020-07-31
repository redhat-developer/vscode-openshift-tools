/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export interface ImageStream {
    apiVersion: 'image.openshift.io/v1';
    kind: 'ImageStream';
    spec: {
        tags: [{
            name: string;
            annotations:{
                tags: string;
            };
        }];
    }

}
