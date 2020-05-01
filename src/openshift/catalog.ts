/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Odo, OdoImpl, Command } from '../odo';
import { Platform } from '../util/platform';
import { vsCommand } from '../vscommand';

export class Catalog {
    private static odo: Odo = OdoImpl.Instance;

    private componentsJson: any[] = [];

    @vsCommand('openshift.catalog.listComponents')
    static listComponents(): void {
        Catalog.odo.executeInTerminal(Command.listCatalogComponents(), Platform.getUserHomePath(), 'OpenShift: List Available Component Types');
    }

    @vsCommand('openshift.catalog.listServices')
    static listServices(): void {
        Catalog.odo.executeInTerminal(Command.listCatalogServices(), Platform.getUserHomePath(), 'OpenShift: List Available Services');
    }

    async getComponentNames(): Promise<string[]> {
        this.componentsJson = await Catalog.odo.getComponentTypesJson();
        return this.componentsJson.map((value) => value.metadata.name);
    }

    getComponentVersions(componentName: string): string[] {
        const component = this.componentsJson.find(
            (value) => value.metadata.name === componentName,
        );
        return component ? component.spec.allTags : [];
    }
}
