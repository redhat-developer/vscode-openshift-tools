/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Odo, OdoImpl } from '../odo';
import { Command } from '../odo/command';
import { Platform } from '../util/platform';
import { vsCommand } from '../vscommand';

export class Catalog {
    private static odo: Odo = OdoImpl.Instance;

    @vsCommand('openshift.catalog.listComponents')
    static listComponents(): void {
        Catalog.odo.executeInTerminal(Command.listCatalogComponents(), Platform.getUserHomePath(), 'OpenShift: List Available Component Types');
    }

    @vsCommand('openshift.catalog.listServices')
    static listServices(): void {
        Catalog.odo.executeInTerminal(Command.listCatalogServices(), Platform.getUserHomePath(), 'OpenShift: List Available Services');
    }
}
