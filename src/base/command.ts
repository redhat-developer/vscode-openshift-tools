/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Platform } from '../util/platform';

const QUOTE = Platform.OS === 'win32' ? '"' : '\'';

export class CommandOption {
    protected privacy = false;
    constructor(public readonly name: string, public readonly value?: string, public readonly redacted = true, public readonly quoted = false) {
    }

    toString(): string {
        if (this.privacy) {
            return this.toPrivateString();
        }
        return `${this.name}${this.value ? `=${this.quote}${this.value}${this.quote}` : '' }`;
    }

    toPrivateString(): string {
        return `${this.name}${this.value && this.redacted? ' REDACTED' : '' }`
    }

    privacyMode(set: boolean): void {
        this.privacy = set;
    }

    get quote(): string {
        return this.quoted? QUOTE : '';
    }
}

export class CommandText {
    private privacy = false;
    constructor(public readonly command: string, public readonly parameter?: string, public readonly options: CommandOption[] = []) {
    }

    toString(): string {
        return `${this.command}${this.parameter? ` ${this.privacy? 'REDACTED' : this.parameter}`: ''}${this.options && this.options.length > 0? ` ${this.options.join(' ')}`: ''}`;
    }

    privacyMode(set: boolean): CommandText {
        this.privacy = set;
        this.options.forEach(element => element.privacyMode(true));
        return this;
    }

    addOption(option: CommandOption): CommandText {
       this.options.push(option);
       return this;
    }
}