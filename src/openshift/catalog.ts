/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Odo, OdoImpl, Command } from "../odo";
import { Platform } from "../util/platform";

export class Catalog {
    private static odo: Odo = OdoImpl.Instance;

    static listComponents(): void {
        Catalog.odo.executeInTerminal(Command.listCatalogComponents(), Platform.getUserHomePath());
    }

    static listServices(): void {
        Catalog.odo.executeInTerminal(Command.listCatalogServices(), Platform.getUserHomePath());
    }
}