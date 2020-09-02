/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ComponentMetadata } from './config';
import { ComponentKind } from './componentType';

export interface S2iComponent {
    kind: 'Component';
    apiVersion: string;
    metadata: ComponentMetadata;
    spec: {
        app: string;
        type: string;
        sourceType: 'local' | 'git' | 'binary';
        env: [
            {
                name: string;
                value: string;
            }
        ];
    };
    status: {
        state: string;
    };
}

export interface DevfileComponent {
    kind: "DevfileComponent";
    apiVersion: string;
    metadata: {
        name: string;
        creationTimestamp: string;
    },
    spec: {
        namespace: string;
        application: string;
        componentType: string;
    },
    status: {
        state: string;
    }
}

export interface ComponentsJson {
    kind: string;
	apiVersion: string;
	metadata: {
		creationTimestamp: string;
    },
    // eslint-disable-next-line camelcase
    s2i_components: S2iComponent[];
    // eslint-disable-next-line camelcase
    devfile_components: DevfileComponent[];
}

export interface Component <I> {
    label: string;
    name: string;
    namespace: string;
    app: string;
    type: string;
    sourceType: string;
    kind: ComponentKind;
    info: I;
}

export type OdoComponent = Component<S2iComponent | DevfileComponent>;

abstract class ComponentAdapter<I> implements Component<I> {
    constructor(public readonly info: I, public readonly kind: ComponentKind) {
    }

    get label(): string {
        return `${this.name} (${this.kind})`;
    }

    abstract get name(): string;
    abstract get app(): string;
    abstract get namespace(): string;
    abstract get type(): string;
    abstract get sourceType(): string;
}

export class S2iComponentAdapter extends ComponentAdapter<S2iComponent> implements Component<S2iComponent> {

    constructor(public readonly info: S2iComponent) {
        super(info, ComponentKind.S2I);
    }

    get name(): string {
        return this.info.metadata.name;
    }

    get app(): string {
        return this.info.spec.app;
    };

    get namespace(): string {
        return this.info.metadata.namespace;
    }

    get type(): string {
        return this.info.spec.type;
    }

    get sourceType(): string {
        return this.info.spec.sourceType;
    }
}

export class DevfileComponentAdapter extends ComponentAdapter<DevfileComponent> {

    constructor(public readonly info: DevfileComponent) {
        super(info, ComponentKind.DEVFILE);
    }

    get name(): string {
        return this.info.metadata.name;
    }

    get app(): string {
        return this.info.spec.application;
    }

    get namespace(): string {
        return this.info.spec.namespace;
    }

    get type(): string {
        return this.info.spec.componentType;
    }

    get sourceType(): string {
        return 'local';
    }
}