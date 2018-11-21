/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Odo, OdoImpl } from "../odo";

export class Catalog {
    private static odo: Odo = OdoImpl.getInstance();

    static listComponents(): void {
        Catalog.odo.executeInTerminal(`odo catalog list components`);
    }

    static listServices(): void {
        Catalog.odo.executeInTerminal(`odo catalog list services`);
    }
}