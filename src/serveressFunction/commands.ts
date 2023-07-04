/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandText, CommandOption } from '../base/command';

export class Command {

    static createFunction(language: string, template: string, location: string): CommandText {
        return new CommandText(`func create ${location}`, undefined, [
            new CommandOption('-l', language),
            new CommandOption('-t', template)
        ]);
    }

}
