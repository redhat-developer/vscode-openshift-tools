/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Odo, OdoImpl, Command } from "../odo";

export class Catalog {
    private static odo: Odo = OdoImpl.getInstance();

    static listComponents(): void {
        Catalog.odo.executeInTerminal(Command.listCatalogComponents());
    }

    static listServices(): void {
        Catalog.odo.executeInTerminal(Command.listCatalogSevices());
    }
}