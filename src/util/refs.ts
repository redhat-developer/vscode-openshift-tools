/*-----------------------------------------------------------------------------------------------
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)
 * Licensed under the MIT License. See ./refs.license.txt for license information.
 *-----------------------------------------------------------------------------------------------*/
//  Inspired by https://github.com/sindresorhus/remote-git-tags

'use strict';

import url = require('url');
import net = require('net');
import gitclient = require('git-fetch-pack');
import transport = require('git-transport-protocol');

export class Refs {

    static async fetchTag(input: string): Promise<Map<any, any>> {
        return new Promise((resolve, reject) => {
            input = input.replace(/^(?!(?:https|git):\/\/)/, 'https://');

            const tcp = net.connect({
                host: url.parse(input).host,
                port: 9418
            });
            const client = gitclient(input);
            const tags = new Map();

            client.refs.on('data', ref => {

                if (/^refs\/heads/.test(ref.name)) {
                    tags.set(ref.name.split('/')[2].replace(/\^\{\}$/, ''), ref.hash);
                }

                if (/^refs\/tags/.test(ref.name)) {
                    tags.set(ref.name.split('/')[2].replace(/\^\{\}$/, ''), ref.hash);
                }
            });
            client
                .pipe(transport(tcp))
                .on('error', reject)
                .pipe(client)
                .on('error', reject)
                .once('end', () => {
                    resolve(tags);
                });
        });
    }
}
